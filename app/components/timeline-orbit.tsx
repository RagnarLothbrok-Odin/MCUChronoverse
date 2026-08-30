"use client";

import { Html, OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
    type MouseEvent,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { AdditiveBlending, Group, LineCurve3, MathUtils, Vector3 } from "three";
import type { TimelineEntry } from "../data/types";
import { timelineNodePosition } from "../lib/timeline";

const coreColours: Record<TimelineEntry["contentType"], string> = {
    film: "#ff5a4f",
    "one-shot": "#b88cff",
    series: "#5dc9ff",
    short: "#61e4a8",
    special: "#ffe08a",
};

const contentTypeNames: Record<TimelineEntry["contentType"], string> = {
    film: "Film",
    "one-shot": "One-Shot",
    series: "Series",
    short: "Short",
    special: "Special",
};

interface TimelineOrbitProps {
    entries: readonly TimelineEntry[];
    focusIndex: number;
    focusKey: number;
    onSelect: (slug: string) => void;
    selectedSlug?: string;
}

interface TimelineNodeProps {
    compact: boolean;
    count: number;
    entry: TimelineEntry;
    index: number;
    onSelect: (slug: string) => void;
    selected: boolean;
}

function TimelineNode({ compact, count, entry, index, onSelect, selected }: TimelineNodeProps) {
    const ringsRef = useRef(new Group());
    const position = timelineNodePosition(index, count);
    const handleSelect = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            onSelect(entry.slug);
        },
        [entry.slug, onSelect]
    );

    useFrame((_, delta) => {
        ringsRef.current.rotation.x += delta * 0.11;
    });

    return (
        <group position={[position.x, position.y, position.z]}>
            <group ref={ringsRef} rotation={[0, Math.PI / 2, 0]}>
                <mesh>
                    <torusGeometry args={[selected ? 0.45 : 0.32, 0.012, 8, 48]} />
                    <meshBasicMaterial
                        blending={AdditiveBlending}
                        color="#ffad52"
                        depthWrite={false}
                        opacity={selected ? 0.9 : 0.45}
                        transparent
                    />
                </mesh>
                <mesh rotation={[0.8, 0, 0]}>
                    <torusGeometry args={[selected ? 0.34 : 0.24, 0.008, 8, 40]} />
                    <meshBasicMaterial
                        blending={AdditiveBlending}
                        color="#ffe0a3"
                        depthWrite={false}
                        opacity={0.32}
                        transparent
                    />
                </mesh>
            </group>
            <mesh scale={selected ? 1.55 : 1}>
                <sphereGeometry args={[0.11, 24, 24]} />
                <meshStandardMaterial
                    color={coreColours[entry.contentType]}
                    emissive={coreColours[entry.contentType]}
                    emissiveIntensity={selected ? 5 : 2.8}
                    roughness={0.2}
                />
            </mesh>
            {!compact || selected || index % 2 === 0 ? (
                <Html center distanceFactor={10} position={[0, 0.68, 0]} zIndexRange={[20, 0]}>
                    <button
                        className={`timeline-node-label ${selected ? "timeline-node-label-selected" : ""}`}
                        onClick={handleSelect}
                        type="button"
                    >
                        <span className="timeline-node-label-type">
                            {contentTypeNames[entry.contentType]}
                        </span>
                        <span>{entry.placement}</span>
                        {entry.title}
                    </button>
                </Html>
            ) : null}
        </group>
    );
}

interface TargetableControls {
    target: Vector3;
    update: () => void;
}

function isTargetableControls(controls: unknown): controls is TargetableControls {
    return Boolean(
        controls && typeof controls === "object" && "target" in controls && "update" in controls
    );
}

interface CameraRigProps {
    focusKey: number;
    focusX: number;
}

function CameraRig({ focusKey, focusX }: CameraRigProps) {
    const camera = useThree((state) => state.camera);
    const controls = useThree((state) => state.controls);
    const invalidate = useThree((state) => state.invalidate);
    const destination = useRef(Number.NaN);

    useEffect(() => {
        destination.current = focusX;
        invalidate();
    }, [focusKey, focusX, invalidate]);

    useFrame((_, delta) => {
        if (!Number.isFinite(destination.current)) {
            return;
        }
        if (isTargetableControls(controls)) {
            const currentTargetX = controls.target.x;
            const nextTargetX = MathUtils.damp(currentTargetX, destination.current, 7, delta);
            controls.target.x = nextTargetX;
            camera.position.x += nextTargetX - currentTargetX;
            controls.update();
            if (Math.abs(nextTargetX - destination.current) < 0.01) {
                destination.current = Number.NaN;
            }
        } else {
            camera.position.x = MathUtils.damp(camera.position.x, destination.current, 7, delta);
            if (Math.abs(camera.position.x - destination.current) < 0.01) {
                destination.current = Number.NaN;
            }
        }
        if (Number.isFinite(destination.current)) {
            invalidate();
        }
    });

    return null;
}

interface TimelineSceneProps {
    compact: boolean;
    entries: readonly TimelineEntry[];
    focusKey: number;
    focusX: number;
    initialX: number;
    onSelect: (slug: string) => void;
    reducedMotion: boolean;
    selectedSlug?: string;
}

function TimelineScene({
    compact,
    entries,
    focusKey,
    focusX,
    initialX,
    onSelect,
    reducedMotion,
    selectedSlug,
}: TimelineSceneProps) {
    const points = useMemo(
        () =>
            entries.map((_, index) => {
                const position = timelineNodePosition(index, entries.length);
                return new Vector3(position.x, position.y, position.z);
            }),
        [entries]
    );
    const curve = useMemo(() => {
        if (points.length === 0) {
            return new LineCurve3(new Vector3(-2, 0, 0), new Vector3(2, 0, 0));
        }
        const first = points[0] ?? new Vector3();
        const last = points.at(-1) ?? first;
        return new LineCurve3(
            first,
            last.equals(first) ? first.clone().add(new Vector3(0.001, 0, 0)) : last
        );
    }, [points]);
    const span = Math.max((entries.length - 1) * 2.2, 4);
    const initialTarget = useMemo<[number, number, number]>(() => [initialX, 0, 0], [initialX]);

    return (
        <>
            <fog args={["#020203", 12, 35]} attach="fog" />
            <ambientLight intensity={0.45} />
            <pointLight color="#ff782d" intensity={28} position={[0, 4, 6]} />
            <pointLight color="#444cff" intensity={8} position={[0, -5, -3]} />
            <Stars
                count={compact ? 650 : 1600}
                depth={40}
                factor={2.3}
                fade
                radius={70}
                speed={reducedMotion ? 0 : 0.08}
            />
            <Sparkles
                color="#e7a35e"
                count={compact ? 45 : 120}
                opacity={0.45}
                scale={[span + 10, 7, 7]}
                size={1.3}
                speed={reducedMotion ? 0 : 0.14}
            />
            <mesh>
                <tubeGeometry args={[curve, Math.max(entries.length * 20, 80), 0.035, 12, false]} />
                <meshStandardMaterial
                    color="#ffad55"
                    emissive="#ff6b24"
                    emissiveIntensity={4}
                    roughness={0.18}
                />
            </mesh>
            <mesh>
                <tubeGeometry args={[curve, Math.max(entries.length * 20, 80), 0.13, 12, false]} />
                <meshBasicMaterial
                    blending={AdditiveBlending}
                    color="#ff7b36"
                    depthWrite={false}
                    opacity={0.12}
                    transparent
                />
            </mesh>
            {entries.map((entry, index) => (
                <TimelineNode
                    compact={compact}
                    count={entries.length}
                    entry={entry}
                    index={index}
                    key={entry.slug}
                    onSelect={onSelect}
                    selected={selectedSlug === entry.slug}
                />
            ))}
            <OrbitControls
                dampingFactor={0.075}
                enableDamping
                enablePan={false}
                enableRotate
                enableZoom={false}
                makeDefault
                maxDistance={18}
                minDistance={6}
                target={initialTarget}
            />
            <CameraRig focusKey={focusKey} focusX={focusX} />
        </>
    );
}

function supportsWebGl(): boolean {
    try {
        const canvas = document.createElement("canvas");
        return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
        return false;
    }
}

export function TimelineOrbit({
    entries,
    focusIndex,
    focusKey,
    onSelect,
    selectedSlug,
}: TimelineOrbitProps) {
    const [webGlSupported, setWebGlSupported] = useState<boolean | null>(null);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [compact, setCompact] = useState(false);
    const initialX = timelineNodePosition(0, entries.length).x;
    const safeFocusIndex = Math.min(Math.max(focusIndex, 0), Math.max(entries.length - 1, 0));
    const focusX = timelineNodePosition(safeFocusIndex, entries.length).x;

    useEffect(() => {
        setWebGlSupported(supportsWebGl());
        setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        setCompact(
            window.matchMedia("(max-width: 720px)").matches || navigator.hardwareConcurrency <= 4
        );
    }, []);

    if (webGlSupported === null) {
        return (
            <div className="grid h-full place-items-center bg-[#020203]">
                <p className="font-mono text-[0.62rem] text-white/35 uppercase tracking-[0.2em]">
                    Calibrating temporal coordinates
                </p>
            </div>
        );
    }

    if (!webGlSupported) {
        return (
            <div className="grid h-full place-items-center bg-[#020203] p-8 text-center">
                <div className="max-w-md">
                    <p className="font-mono text-gold text-xs uppercase tracking-[0.2em]">
                        3D unavailable
                    </p>
                    <h2 className="mt-4 font-semibold text-3xl tracking-[-0.04em]">
                        This device cannot open the temporal archive.
                    </h2>
                    <p className="mt-4 text-white/48 leading-7">
                        Try a browser with WebGL enabled to explore the interactive timeline.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <Canvas
            camera={{ fov: 43, position: [initialX, 0, 10.5] }}
            dpr={compact ? 1 : [1, 1.5]}
            frameloop={reducedMotion ? "demand" : "always"}
        >
            <Suspense fallback={null}>
                <TimelineScene
                    compact={compact}
                    entries={entries}
                    focusKey={focusKey}
                    focusX={focusX}
                    initialX={initialX}
                    onSelect={onSelect}
                    reducedMotion={reducedMotion}
                    selectedSlug={selectedSlug}
                />
            </Suspense>
        </Canvas>
    );
}
