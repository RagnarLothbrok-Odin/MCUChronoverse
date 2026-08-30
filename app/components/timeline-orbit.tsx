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
import {
    AdditiveBlending,
    type BufferGeometry,
    type Camera,
    CatmullRomCurve3,
    Color,
    type Curve,
    Group,
    LineCurve3,
    MathUtils,
    ShaderMaterial,
    Vector3,
} from "three";
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

const energyVertexShader = /* glsl */ `
    varying vec2 vTimelineUv;

    void main() {
        vTimelineUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const energyFragmentShader = /* glsl */ `
    uniform float uTime;
    varying vec2 vTimelineUv;

    void main() {
        float travellingPulse = pow(
            max(0.0, sin((vTimelineUv.x * 36.0 - uTime * 0.55) * 6.283185)),
            11.0
        );
        float fineShimmer = 0.5 + 0.5 * sin(vTimelineUv.x * 420.0 - uTime * 5.0);
        float edgeHeat = 1.0 - abs(vTimelineUv.y - 0.5) * 0.7;
        vec3 amber = vec3(1.0, 0.29, 0.055);
        vec3 whiteHot = vec3(1.0, 0.92, 0.58);
        vec3 colour = mix(amber, whiteHot, 0.4 + travellingPulse * 0.6);
        float alpha = (0.2 + travellingPulse * 0.62 + fineShimmer * 0.08) * edgeHeat;

        gl_FragColor = vec4(colour, alpha);
    }
`;

const auraVertexShader = /* glsl */ `
    varying vec2 vTimelineUv;
    varying float vFacing;

    void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vec3 viewNormal = normalize(normalMatrix * normal);
        vec3 viewDirection = normalize(-viewPosition.xyz);
        vTimelineUv = uv;
        vFacing = max(dot(viewNormal, viewDirection), 0.0);
        gl_Position = projectionMatrix * viewPosition;
    }
`;

const auraFragmentShader = /* glsl */ `
    uniform vec3 uColour;
    uniform float uNoiseScale;
    uniform float uOpacity;
    uniform float uTime;
    uniform float uFlowSpeed;
    varying vec2 vTimelineUv;
    varying float vFacing;

    float random(vec2 coordinates) {
        return fract(sin(dot(coordinates, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float noise(vec2 coordinates) {
        vec2 cell = floor(coordinates);
        vec2 local = fract(coordinates);
        local = local * local * (3.0 - 2.0 * local);
        float lowerLeft = random(cell);
        float lowerRight = random(cell + vec2(1.0, 0.0));
        float upperLeft = random(cell + vec2(0.0, 1.0));
        float upperRight = random(cell + vec2(1.0, 1.0));
        return mix(
            mix(lowerLeft, lowerRight, local.x),
            mix(upperLeft, upperRight, local.x),
            local.y
        );
    }

    void main() {
        vec2 noiseCoordinates = vec2(
            vTimelineUv.x * uNoiseScale - uTime * uFlowSpeed,
            sin(vTimelineUv.y * 6.283185) * 1.8 + uTime * 0.08
        );
        float broadNoise = noise(noiseCoordinates);
        float fineNoise = noise(noiseCoordinates * 2.7 + 5.1);
        float turbulence = smoothstep(0.08, 0.92, broadNoise * 0.72 + fineNoise * 0.28);
        float feather = pow(vFacing, 1.65);
        float breathing = 0.86 + sin(vTimelineUv.x * 74.0 - uTime * 1.8) * 0.14;
        float alpha = uOpacity * feather * (0.42 + turbulence * 0.74) * breathing;
        vec3 hotColour = mix(uColour, vec3(1.0, 0.66, 0.28), turbulence * 0.34);

        gl_FragColor = vec4(hotColour, alpha);
    }
`;

const moteVertexShader = /* glsl */ `
    uniform float uSize;

    void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * (10.0 / max(2.0, -viewPosition.z));
        gl_Position = projectionMatrix * viewPosition;
    }
`;

const moteFragmentShader = /* glsl */ `
    void main() {
        float distanceToCentre = length(gl_PointCoord - vec2(0.5));
        float alpha = 1.0 - smoothstep(0.06, 0.5, distanceToCentre);
        vec3 colour = mix(
            vec3(1.0, 0.28, 0.05),
            vec3(1.0, 0.93, 0.58),
            1.0 - smoothstep(0.0, 0.34, distanceToCentre)
        );
        gl_FragColor = vec4(colour, alpha * 0.8);
    }
`;

function createAuraMaterial({
    colour,
    flowSpeed,
    noiseScale,
    opacity,
}: {
    colour: string;
    flowSpeed: number;
    noiseScale: number;
    opacity: number;
}): ShaderMaterial {
    return new ShaderMaterial({
        blending: AdditiveBlending,
        depthWrite: false,
        fragmentShader: auraFragmentShader,
        toneMapped: false,
        transparent: true,
        uniforms: {
            uColour: { value: new Color(colour) },
            uFlowSpeed: { value: flowSpeed },
            uNoiseScale: { value: noiseScale },
            uOpacity: { value: opacity },
            uTime: { value: 0 },
        },
        vertexShader: auraVertexShader,
    });
}

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
    const handleOrbSelect = useCallback(
        (event: { stopPropagation: () => void }) => {
            event.stopPropagation();
            onSelect(entry.slug);
        },
        [entry.slug, onSelect]
    );
    const handleOrbPointerOver = useCallback((event: { stopPropagation: () => void }) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
    }, []);
    const handleOrbPointerOut = useCallback((event: { stopPropagation: () => void }) => {
        event.stopPropagation();
        document.body.style.cursor = "default";
    }, []);

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
            {/* Three.js meshes are interactive scene targets, even though they are not DOM controls. */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: The orb is the scene's interactive control. */}
            <mesh
                onClick={handleOrbSelect}
                onPointerOut={handleOrbPointerOut}
                onPointerOver={handleOrbPointerOver}
                scale={selected ? 1.55 : 1}
            >
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

function createTimelineCurve(points: readonly Vector3[]): Curve<Vector3> {
    const first = points[0] ?? new Vector3(-2, 0, 0);
    const last = points.at(-1) ?? new Vector3(2, 0, 0);
    if (points.length < 3) {
        return new LineCurve3(
            first,
            last.equals(first) ? first.clone().add(new Vector3(0.001, 0, 0)) : last
        );
    }
    return new CatmullRomCurve3([...points], false, "catmullrom", 0.42);
}

interface TimelineEnergyProps {
    compact: boolean;
    curve: Curve<Vector3>;
    eventCount: number;
    reducedMotion: boolean;
}

function TimelineEnergy({ compact, curve, eventCount, reducedMotion }: TimelineEnergyProps) {
    const moteGeometryRef = useRef<BufferGeometry>(null);
    const segmentCount = Math.max(eventCount * (compact ? 10 : 16), 96);
    const moteCount = compact ? 20 : 44;
    const flowMaterial = useMemo(
        () =>
            new ShaderMaterial({
                blending: AdditiveBlending,
                depthWrite: false,
                fragmentShader: energyFragmentShader,
                toneMapped: false,
                transparent: true,
                uniforms: {
                    uTime: { value: 0 },
                },
                vertexShader: energyVertexShader,
            }),
        []
    );
    const outerAuraMaterial = useMemo(
        () =>
            createAuraMaterial({
                colour: "#f14d16",
                flowSpeed: 0.36,
                noiseScale: 62,
                opacity: 0.2,
            }),
        []
    );
    const innerAuraMaterial = useMemo(
        () =>
            createAuraMaterial({
                colour: "#ff7c27",
                flowSpeed: 0.52,
                noiseScale: 88,
                opacity: 0.34,
            }),
        []
    );
    const moteMaterial = useMemo(
        () =>
            new ShaderMaterial({
                blending: AdditiveBlending,
                depthWrite: false,
                fragmentShader: moteFragmentShader,
                toneMapped: false,
                transparent: true,
                uniforms: {
                    uSize: { value: compact ? 5 : 7 },
                },
                vertexShader: moteVertexShader,
            }),
        [compact]
    );
    const motePositions = useMemo(() => new Float32Array(moteCount * 3), [moteCount]);
    const moteSeeds = useMemo(
        () =>
            Array.from({ length: moteCount }, (_, index) => ({
                orbit: 0.04 + ((index * 17) % 11) * 0.008,
                phase: ((index * 37) % moteCount) / moteCount,
                speed: 0.009 + ((index * 13) % 7) * 0.0015,
            })),
        [moteCount]
    );
    const wispCurves = useMemo(
        () =>
            [-1, 1, 2].map((lane) => {
                const samples = curve.getSpacedPoints(Math.max(eventCount * 3, 48));
                const offsetPoints = samples.map((point, index) => {
                    const progress = index / Math.max(samples.length - 1, 1);
                    const envelope = Math.sin(progress * Math.PI);
                    return point
                        .clone()
                        .add(
                            new Vector3(
                                0,
                                Math.sin(progress * 42 + lane * 1.7) * 0.14 * envelope,
                                Math.cos(progress * 37 + lane * 2.3) * 0.18 * envelope
                            )
                        );
                });
                return createTimelineCurve(offsetPoints);
            }),
        [curve, eventCount]
    );

    useEffect(
        () => () => {
            flowMaterial.dispose();
            innerAuraMaterial.dispose();
            moteMaterial.dispose();
            outerAuraMaterial.dispose();
        },
        [flowMaterial, innerAuraMaterial, moteMaterial, outerAuraMaterial]
    );

    useFrame(({ clock }) => {
        const elapsed = reducedMotion ? 0 : clock.elapsedTime;
        flowMaterial.uniforms.uTime.value = elapsed;
        innerAuraMaterial.uniforms.uTime.value = elapsed;
        outerAuraMaterial.uniforms.uTime.value = elapsed;
        const positionAttribute = moteGeometryRef.current?.getAttribute("position");
        if (!positionAttribute) {
            return;
        }
        for (const [index, seed] of moteSeeds.entries()) {
            const progress = (seed.phase + elapsed * seed.speed) % 1;
            const point = curve.getPointAt(progress);
            const angle = progress * Math.PI * 28 + seed.phase * Math.PI * 2 + elapsed * 0.35;
            positionAttribute.setXYZ(
                index,
                point.x,
                point.y + Math.abs(Math.sin(angle)) * seed.orbit * 1.8 + seed.orbit * 0.18,
                point.z + Math.cos(angle) * seed.orbit
            );
        }
        positionAttribute.needsUpdate = true;
    });

    return (
        <group>
            <mesh renderOrder={0}>
                <tubeGeometry args={[curve, segmentCount, 0.36, 20, false]} />
                <primitive attach="material" object={outerAuraMaterial} />
            </mesh>
            <mesh renderOrder={1}>
                <tubeGeometry args={[curve, segmentCount, 0.17, 18, false]} />
                <primitive attach="material" object={innerAuraMaterial} />
            </mesh>
            <mesh renderOrder={2}>
                <tubeGeometry args={[curve, segmentCount, 0.078, 18, false]} />
                <primitive attach="material" object={flowMaterial} />
            </mesh>
            <mesh renderOrder={3}>
                <tubeGeometry args={[curve, segmentCount, 0.026, 14, false]} />
                <meshBasicMaterial color="#fff1b8" toneMapped={false} />
            </mesh>
            {wispCurves.map((wispCurve, index) => (
                <mesh key={`energy-wisp-${index}`} renderOrder={1}>
                    <tubeGeometry args={[wispCurve, segmentCount, 0.013, 5, false]} />
                    <meshBasicMaterial
                        blending={AdditiveBlending}
                        color={index === 2 ? "#ffbc64" : "#ff7430"}
                        depthWrite={false}
                        opacity={index === 2 ? 0.34 : 0.46}
                        toneMapped={false}
                        transparent
                    />
                </mesh>
            ))}
            <points renderOrder={4}>
                <bufferGeometry ref={moteGeometryRef}>
                    <bufferAttribute args={[motePositions, 3]} attach="attributes-position" />
                </bufferGeometry>
                <primitive attach="material" object={moteMaterial} />
            </points>
        </group>
    );
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
    const curve = useMemo(() => createTimelineCurve(points), [points]);
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
            <TimelineEnergy
                compact={compact}
                curve={curve}
                eventCount={entries.length}
                reducedMotion={reducedMotion}
            />
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
