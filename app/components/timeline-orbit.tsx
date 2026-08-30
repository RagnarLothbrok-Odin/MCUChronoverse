"use client";

import { Html, OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
    type ChangeEvent,
    type MouseEvent,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { AdditiveBlending, type Camera, Group, LineCurve3, MathUtils, Vector3 } from "three";
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

const MIN_ZOOM_DISTANCE = 6;
const MAX_ZOOM_DISTANCE = 18;
const DEFAULT_ZOOM_DISTANCE = (MIN_ZOOM_DISTANCE + MAX_ZOOM_DISTANCE) / 2;
const ZOOM_STORAGE_KEY = "mcu-chronoverse:zoom-distance-v2";

interface TimelineOrbitProps {
    entries: readonly TimelineEntry[];
    focusIndex: number;
    focusKey: number;
    onSelect: (slug: string) => void;
    selectedSlug?: string;
}

interface TimelineNodeProps {
    count: number;
    entry: TimelineEntry;
    index: number;
    onSelect: (slug: string) => void;
    selected: boolean;
}

function TimelineNode({ count, entry, index, onSelect, selected }: TimelineNodeProps) {
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
            <Html
                center
                distanceFactor={10}
                key={`${entry.slug}-${selected ? "selected" : "default"}`}
                position={[0, 0.68, 0]}
                zIndexRange={selected ? [25, 25] : [20, 0]}
            >
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

interface MutableNumberRef {
    current: number;
}

function updateFocusPosition(
    camera: Camera,
    controls: TargetableControls | null,
    destination: MutableNumberRef,
    delta: number
): boolean {
    if (!Number.isFinite(destination.current)) {
        return false;
    }

    if (controls) {
        const currentTargetX = controls.target.x;
        const nextTargetX = MathUtils.damp(currentTargetX, destination.current, 7, delta);
        controls.target.x = nextTargetX;
        camera.position.x += nextTargetX - currentTargetX;
        if (Math.abs(nextTargetX - destination.current) < 0.01) {
            destination.current = Number.NaN;
        }
    } else {
        camera.position.x = MathUtils.damp(camera.position.x, destination.current, 7, delta);
        if (Math.abs(camera.position.x - destination.current) < 0.01) {
            destination.current = Number.NaN;
        }
    }

    return Number.isFinite(destination.current);
}

function updateZoomDistance({
    appliedDistance,
    camera,
    cameraOffset,
    controls,
    delta,
    onZoomDistanceChange,
    targetDistance,
}: {
    appliedDistance: MutableNumberRef;
    camera: Camera;
    cameraOffset: Vector3;
    controls: TargetableControls;
    delta: number;
    onZoomDistanceChange: (distance: number) => void;
    targetDistance: MutableNumberRef;
}): number {
    const currentDistance = camera.position.distanceTo(controls.target);
    if (!Number.isFinite(appliedDistance.current)) {
        appliedDistance.current = currentDistance;
    } else if (
        Math.abs(currentDistance - appliedDistance.current) > 0.08 &&
        Math.abs(currentDistance - targetDistance.current) > 0.08
    ) {
        const nextDistance = MathUtils.clamp(currentDistance, MIN_ZOOM_DISTANCE, MAX_ZOOM_DISTANCE);
        targetDistance.current = nextDistance;
        onZoomDistanceChange(nextDistance);
    }

    const nextDistance = MathUtils.damp(currentDistance, targetDistance.current, 9, delta);
    if (Math.abs(nextDistance - currentDistance) > 0.001) {
        cameraOffset.copy(camera.position).sub(controls.target).normalize();
        camera.position.copy(controls.target).addScaledVector(cameraOffset, nextDistance);
    }
    return nextDistance;
}

interface CameraRigProps {
    focusKey: number;
    focusX: number;
    onZoomDistanceChange: (distance: number) => void;
    zoomDistance: number;
}

function CameraRig({ focusKey, focusX, onZoomDistanceChange, zoomDistance }: CameraRigProps) {
    const camera = useThree((state) => state.camera);
    const controls = useThree((state) => state.controls);
    const invalidate = useThree((state) => state.invalidate);
    const destination = useRef(Number.NaN);
    const targetZoomDistance = useRef(zoomDistance);
    const appliedZoomDistance = useRef(Number.NaN);
    const cameraOffset = useRef(new Vector3());

    useEffect(() => {
        destination.current = focusX;
        invalidate();
    }, [focusKey, focusX, invalidate]);

    useEffect(() => {
        targetZoomDistance.current = zoomDistance;
        invalidate();
    }, [invalidate, zoomDistance]);

    useFrame((_, delta) => {
        const timelineControls = isTargetableControls(controls) ? controls : null;
        if (!(timelineControls || Number.isFinite(destination.current))) {
            return;
        }
        const focusMoving = updateFocusPosition(camera, timelineControls, destination, delta);
        if (timelineControls) {
            updateZoomDistance({
                appliedDistance: appliedZoomDistance,
                camera,
                cameraOffset: cameraOffset.current,
                controls: timelineControls,
                delta,
                onZoomDistanceChange,
                targetDistance: targetZoomDistance,
            });
            timelineControls.update();
            appliedZoomDistance.current = camera.position.distanceTo(timelineControls.target);
        }

        const zoomMoving =
            timelineControls &&
            Math.abs(
                camera.position.distanceTo(timelineControls.target) - targetZoomDistance.current
            ) > 0.01;
        if (focusMoving || zoomMoving) {
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
    onZoomDistanceChange: (distance: number) => void;
    reducedMotion: boolean;
    selectedSlug?: string;
    zoomDistance: number;
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
    onZoomDistanceChange,
    zoomDistance,
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
                enableZoom
                makeDefault
                maxDistance={MAX_ZOOM_DISTANCE}
                minDistance={MIN_ZOOM_DISTANCE}
                target={initialTarget}
                zoomSpeed={0.7}
            />
            <CameraRig
                focusKey={focusKey}
                focusX={focusX}
                onZoomDistanceChange={onZoomDistanceChange}
                zoomDistance={zoomDistance}
            />
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
    const [zoomDistance, setZoomDistance] = useState(DEFAULT_ZOOM_DISTANCE);
    const [zoomStorageReady, setZoomStorageReady] = useState(false);
    const initialX = timelineNodePosition(0, entries.length).x;
    const safeFocusIndex = Math.min(Math.max(focusIndex, 0), Math.max(entries.length - 1, 0));
    const focusX = timelineNodePosition(safeFocusIndex, entries.length).x;
    const zoomLevel = Math.round(
        ((MAX_ZOOM_DISTANCE - zoomDistance) / (MAX_ZOOM_DISTANCE - MIN_ZOOM_DISTANCE)) * 100
    );

    const handleZoomChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const nextZoomLevel = Number(event.currentTarget.value);
        if (!Number.isFinite(nextZoomLevel)) {
            return;
        }
        const clampedZoomLevel = MathUtils.clamp(nextZoomLevel, 0, 100);
        setZoomDistance(
            MAX_ZOOM_DISTANCE - (clampedZoomLevel / 100) * (MAX_ZOOM_DISTANCE - MIN_ZOOM_DISTANCE)
        );
    }, []);
    const handleZoomDistanceChange = useCallback((nextDistance: number) => {
        const roundedDistance = Math.round(nextDistance * 10) / 10;
        setZoomDistance((current) =>
            Math.abs(current - roundedDistance) < 0.05 ? current : roundedDistance
        );
    }, []);

    useEffect(() => {
        try {
            const storedValue = window.localStorage.getItem(ZOOM_STORAGE_KEY);
            if (storedValue !== null) {
                const storedZoomDistance = Number(storedValue);
                if (Number.isFinite(storedZoomDistance)) {
                    setZoomDistance(
                        MathUtils.clamp(storedZoomDistance, MIN_ZOOM_DISTANCE, MAX_ZOOM_DISTANCE)
                    );
                }
            }
        } catch {
            // Storage can be unavailable in private browsing contexts.
        }
        setZoomStorageReady(true);
    }, []);

    useEffect(() => {
        if (!zoomStorageReady) {
            return;
        }
        try {
            window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomDistance));
        } catch {
            // Storage can be unavailable in private browsing contexts.
        }
    }, [zoomDistance, zoomStorageReady]);

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
        <div className="relative h-full w-full">
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
                        onZoomDistanceChange={handleZoomDistanceChange}
                        reducedMotion={reducedMotion}
                        selectedSlug={selectedSlug}
                        zoomDistance={zoomDistance}
                    />
                </Suspense>
            </Canvas>
            <fieldset aria-label="Timeline zoom" className="timeline-zoom-control">
                <div className="timeline-zoom-heading">
                    <span className="timeline-zoom-label">Zoom</span>
                    <span className="timeline-zoom-value">{zoomLevel}%</span>
                </div>
                <div className="timeline-zoom-slider">
                    <div
                        aria-hidden="true"
                        className="timeline-zoom-slider-fill"
                        style={{ width: `${zoomLevel}%` }}
                    />
                    <input
                        aria-label="Timeline zoom"
                        className="focus-ring timeline-zoom-input"
                        max="100"
                        min="0"
                        onChange={handleZoomChange}
                        step="1"
                        type="range"
                        value={zoomLevel}
                    />
                </div>
            </fieldset>
        </div>
    );
}
