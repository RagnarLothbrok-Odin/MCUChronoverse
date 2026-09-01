"use client";

import {
    Billboard,
    Image as DreiImage,
    OrbitControls,
    Sparkles,
    Stars,
    Text,
    useCursor,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    AdditiveBlending,
    type BufferGeometry,
    type Camera,
    CatmullRomCurve3,
    Color,
    type Curve,
    Group,
    LineCurve3,
    type Material,
    MathUtils,
    type Mesh,
    PlaneGeometry,
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
const cardAccentColours: Record<TimelineEntry["contentType"], string> = {
    film: "#d98a7d",
    "one-shot": "#b88cff",
    series: "#65cfff",
    short: "#61e4a8",
    special: "#ffe08a",
};
const TIMELINE_CARD_FOCUS_OFFSET_Y = 1.28;

const CARD_WIDTH = 1.29;
const CARD_BASE_HEIGHT = 2.6;
const CARD_RADIUS = 0.098;
const CARD_GAP_FROM_ORB = 0.22;
const CARD_PADDING = 0.08;
const POSTER_WIDTH = CARD_WIDTH - CARD_PADDING * 2;
const POSTER_HEIGHT = POSTER_WIDTH * 1.5;
const META_LEFT = -CARD_WIDTH / 2 + CARD_PADDING + 0.05;
const POSTER_META_GAP = 0.094;
const META_FONT_SIZE = 0.114;
const META_ROW_STEP = 0.198;
const TITLE_ROW_STEP = 0.226;
const TITLE_FONT_SIZE = 0.142;
const META_LINE_HEIGHT = META_FONT_SIZE * 1.3;
const TITLE_LINE_HEIGHT = TITLE_FONT_SIZE * 1.3;
const CARD_TEXT_WIDTH = CARD_WIDTH - (CARD_PADDING + 0.05) * 2;
const CARD_PLANE_GEOMETRY = new PlaneGeometry(1, 1);
const GEIST_FONT_URL =
    "https://fonts.gstatic.com/s/geist/v5/gyBhhwUxId8gMGYQMKR3pzfaWI_Re-Q4nQ.ttf";
const GEIST_MONO_FONT_URL =
    "https://fonts.gstatic.com/s/geistmono/v6/or3yQ6H-1_WfwkMZI_qYPLs1a-t7PU0AbeE9KJ5T.ttf";
const NARROW_TITLE_CHARACTER_PATTERN = /[ilI1'.,:]/;
const WIDE_TITLE_CHARACTER_PATTERN = /[MW@%]/;
const WHITESPACE_CHARACTER_PATTERN = /\s/;
const UPPERCASE_CHARACTER_PATTERN = /[A-Z]/;
const TITLE_WORD_SEPARATOR_PATTERN = /\s+/;

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

const panelVertexShader = /* glsl */ `
    varying vec2 vPanelUv;
    varying vec2 vPanelSize;

    void main() {
        vPanelUv = uv;
        vPanelSize = vec2(
            length(modelMatrix[0].xyz),
            length(modelMatrix[1].xyz)
        );
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const panelFragmentShader = /* glsl */ `
    uniform vec3 uAccentColour;
    uniform vec3 uBorderColour;
    uniform vec3 uSurfaceColour;
    uniform float uAccentStrength;
    uniform float uBorderOpacity;
    uniform float uBorderWidth;
    uniform float uEdgeAccentOpacity;
    uniform float uRadius;
    uniform float uSurfaceOpacity;
    varying vec2 vPanelUv;
    varying vec2 vPanelSize;

    float roundedBoxDistance(vec2 point, vec2 bounds, float radius) {
        vec2 offset = abs(point) - bounds + radius;
        return length(max(offset, 0.0)) + min(max(offset.x, offset.y), 0.0) - radius;
    }

    void main() {
        vec2 panelSize = max(vPanelSize, vec2(0.0001));
        vec2 point = (vPanelUv - 0.5) * panelSize;
        float distanceToEdge = roundedBoxDistance(point, panelSize * 0.5, uRadius);
        float antialiasWidth = max(fwidth(distanceToEdge), 0.0008);
        float outerMask = 1.0 - smoothstep(-antialiasWidth, antialiasWidth, distanceToEdge);
        float innerMask = 1.0 - smoothstep(
            -uBorderWidth - antialiasWidth,
            -uBorderWidth + antialiasWidth,
            distanceToEdge
        );
        float borderMask = max(outerMask - innerMask, 0.0);
        float topEdgeWidth = max(uBorderWidth * 2.5, 0.001);
        float topEdgeMask = smoothstep(
            panelSize.y * 0.5 - topEdgeWidth,
            panelSize.y * 0.5 + antialiasWidth,
            point.y
        );
        float horizontalEdgeFade = 1.0 - smoothstep(
            -panelSize.x * 0.48,
            panelSize.x * 0.32,
            point.x
        );
        float edgeAccentMask = borderMask
            * topEdgeMask
            * horizontalEdgeFade
            * uEdgeAccentOpacity;
        float accentGlow = 1.0 - smoothstep(
            0.0,
            0.92,
            distance(vPanelUv, vec2(0.04, 0.98))
        );
        vec3 surfaceColour = mix(
            uSurfaceColour,
            uAccentColour,
            accentGlow * uAccentStrength
        );
        vec3 colour = mix(uBorderColour, surfaceColour, innerMask);
        colour = mix(colour, uAccentColour, edgeAccentMask);
        float alpha = innerMask * uSurfaceOpacity + borderMask * uBorderOpacity;
        alpha = min(1.0, alpha + edgeAccentMask * (1.0 - alpha));

        gl_FragColor = vec4(colour, alpha * outerMask);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

const posterShadeFragmentShader = /* glsl */ `
    varying vec2 vPanelUv;

    void main() {
        float shade = smoothstep(0.35, 0.0, vPanelUv.y) * 0.22;
        gl_FragColor = vec4(0.012, 0.012, 0.02, shade);
        #include <colorspace_fragment>
    }
`;

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

interface PanelMaterialOptions {
    accentColour: string;
    accentStrength: number;
    borderColour: string;
    borderOpacity: number;
    borderWidth: number;
    edgeAccentOpacity: number;
    radius: number;
    surfaceColour: string;
    surfaceOpacity: number;
}

function createPanelMaterial({
    accentColour,
    accentStrength,
    borderColour,
    borderOpacity,
    borderWidth,
    edgeAccentOpacity,
    radius,
    surfaceColour,
    surfaceOpacity,
}: PanelMaterialOptions): ShaderMaterial {
    return new ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        fragmentShader: panelFragmentShader,
        toneMapped: false,
        transparent: true,
        uniforms: {
            uAccentColour: { value: new Color(accentColour) },
            uAccentStrength: { value: accentStrength },
            uBorderColour: { value: new Color(borderColour) },
            uBorderOpacity: { value: borderOpacity },
            uBorderWidth: { value: borderWidth },
            uEdgeAccentOpacity: { value: edgeAccentOpacity },
            uRadius: { value: radius },
            uSurfaceColour: { value: new Color(surfaceColour) },
            uSurfaceOpacity: { value: surfaceOpacity },
        },
        vertexShader: panelVertexShader,
    });
}

function createCardSurfaceMaterial(accentColour: string, highlighted: boolean): ShaderMaterial {
    return createPanelMaterial({
        accentColour,
        accentStrength: highlighted ? 0.13 : 0.07,
        borderColour: highlighted ? accentColour : "#ffffff",
        borderOpacity: highlighted ? 0.42 : 0.11,
        borderWidth: 0.011,
        edgeAccentOpacity: highlighted ? 1 : 0.65,
        radius: CARD_RADIUS,
        surfaceColour: highlighted ? "#08080b" : "#060709",
        surfaceOpacity: highlighted ? 0.92 : 0.82,
    });
}

function createCardGlowMaterial(colour: string): ShaderMaterial {
    const material = createPanelMaterial({
        accentColour: colour,
        accentStrength: 0.24,
        borderColour: colour,
        borderOpacity: 0.14,
        borderWidth: 0.028,
        edgeAccentOpacity: 0,
        radius: CARD_RADIUS + 0.04,
        surfaceColour: "#000000",
        surfaceOpacity: 0.025,
    });
    material.blending = AdditiveBlending;
    return material;
}

type CardSurfaceMaterialSet = Record<
    TimelineEntry["contentType"],
    Record<"highlighted" | "idle", ShaderMaterial>
>;

const cardSurfaceMaterials = {
    film: {
        highlighted: createCardSurfaceMaterial(cardAccentColours.film, true),
        idle: createCardSurfaceMaterial(cardAccentColours.film, false),
    },
    "one-shot": {
        highlighted: createCardSurfaceMaterial(cardAccentColours["one-shot"], true),
        idle: createCardSurfaceMaterial(cardAccentColours["one-shot"], false),
    },
    series: {
        highlighted: createCardSurfaceMaterial(cardAccentColours.series, true),
        idle: createCardSurfaceMaterial(cardAccentColours.series, false),
    },
    short: {
        highlighted: createCardSurfaceMaterial(cardAccentColours.short, true),
        idle: createCardSurfaceMaterial(cardAccentColours.short, false),
    },
    special: {
        highlighted: createCardSurfaceMaterial(cardAccentColours.special, true),
        idle: createCardSurfaceMaterial(cardAccentColours.special, false),
    },
} satisfies CardSurfaceMaterialSet;

const cardGlowMaterials = {
    film: createCardGlowMaterial(cardAccentColours.film),
    "one-shot": createCardGlowMaterial(cardAccentColours["one-shot"]),
    series: createCardGlowMaterial(cardAccentColours.series),
    short: createCardGlowMaterial(cardAccentColours.short),
    special: createCardGlowMaterial(cardAccentColours.special),
} satisfies Record<TimelineEntry["contentType"], ShaderMaterial>;

const cardShadowMaterial = createPanelMaterial({
    accentColour: "#000000",
    accentStrength: 0,
    borderColour: "#000000",
    borderOpacity: 0,
    borderWidth: 0,
    edgeAccentOpacity: 0,
    radius: CARD_RADIUS,
    surfaceColour: "#000000",
    surfaceOpacity: 0.32,
});

const posterFrameMaterial = createPanelMaterial({
    accentColour: "#ffffff",
    accentStrength: 0.02,
    borderColour: "#ffffff",
    borderOpacity: 0.08,
    borderWidth: 0.012,
    edgeAccentOpacity: 0,
    radius: 0.058,
    surfaceColour: "#ffffff",
    surfaceOpacity: 0.03,
});

const posterShadeMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: posterShadeFragmentShader,
    toneMapped: false,
    transparent: true,
    vertexShader: panelVertexShader,
});

function configureOverlayMesh(mesh: Mesh | null): void {
    if (!mesh) {
        return;
    }
    const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
        material.depthTest = false;
        material.depthWrite = false;
        material.toneMapped = false;
    }
}

function getPosterTextureUrl(url: string): string {
    return `/_next/image?url=${encodeURIComponent(url)}&w=256&q=75`;
}

function formatCardPlacement(placement: string): string {
    const maximumCharactersPerLine = 13;
    const words = placement.toUpperCase().split(TITLE_WORD_SEPARATOR_PATTERN);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (currentLine && candidate.length > maximumCharactersPerLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = candidate;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines.join("\n");
}

function titleWidthUnits(value: string): number {
    let width = 0;
    for (const character of value) {
        if (NARROW_TITLE_CHARACTER_PATTERN.test(character)) {
            width += 0.3;
        } else if (WIDE_TITLE_CHARACTER_PATTERN.test(character)) {
            width += 0.9;
        } else if (WHITESPACE_CHARACTER_PATTERN.test(character)) {
            width += 0.32;
        } else if (UPPERCASE_CHARACTER_PATTERN.test(character)) {
            width += 0.64;
        } else {
            width += 0.52;
        }
    }
    return width;
}

function formatCardTitle(title: string): string {
    const maximumLineWidth = 7.3;
    const words = title.split(TITLE_WORD_SEPARATOR_PATTERN);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (currentLine && titleWidthUnits(candidate) > maximumLineWidth) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = candidate;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines.join("\n");
}

interface TimelineOrbitProps {
    entries: readonly TimelineEntry[];
    focusIndex: number;
    focusKey: number;
    onSelect: (slug: string) => void;
    selectedSlug?: string;
}

interface TimelineNodeProps {
    active: boolean;
    count: number;
    entry: TimelineEntry;
    index: number;
    onSelect: (slug: string) => void;
    selected: boolean;
}

interface TimelinePosterCardProps extends TimelineNodeProps {}

function PosterArtwork({
    entry,
    posterPositionY,
    renderOrder,
}: {
    entry: TimelineEntry;
    posterPositionY: number;
    renderOrder: number;
}) {
    if (entry.posterUrl) {
        return (
            <DreiImage
                frustumCulled={false}
                position={[0, posterPositionY, 0.018]}
                radius={0.052}
                ref={configureOverlayMesh}
                renderOrder={renderOrder}
                scale={[POSTER_WIDTH - 0.018, POSTER_HEIGHT - 0.018]}
                toneMapped={false}
                transparent
                url={getPosterTextureUrl(entry.posterUrl)}
            />
        );
    }

    return (
        <Text
            anchorX="center"
            anchorY="middle"
            color={cardAccentColours[entry.contentType]}
            font={GEIST_MONO_FONT_URL}
            fontSize={0.4}
            frustumCulled={false}
            position={[0, posterPositionY, 0.018]}
            ref={configureOverlayMesh}
            renderOrder={renderOrder}
        >
            {entry.title.slice(0, 1)}
        </Text>
    );
}

function TimelinePosterCard({
    active,
    count,
    entry,
    index,
    onSelect,
    selected,
}: TimelinePosterCardProps) {
    const cardRef = useRef(new Group());
    const [hovered, setHovered] = useState(false);
    const highlighted = active || hovered || selected;
    const formattedPlacement = formatCardPlacement(entry.placement);
    const formattedTitle = formatCardTitle(entry.title);
    const placementLineCount = formattedPlacement.split("\n").length;
    const titleLineCount = formattedTitle.split("\n").length;
    const additionalPlacementHeight = (placementLineCount - 1) * META_LINE_HEIGHT;
    const additionalTitleHeight = (titleLineCount - 1) * TITLE_LINE_HEIGHT;
    const cardHeight = CARD_BASE_HEIGHT + additionalPlacementHeight + additionalTitleHeight;
    const posterPositionY = cardHeight / 2 - CARD_PADDING - POSTER_HEIGHT / 2;
    const metaTop = posterPositionY - POSTER_HEIGHT / 2 - POSTER_META_GAP;
    const placementTop = metaTop - META_ROW_STEP;
    const titleTop = placementTop - TITLE_ROW_STEP - additionalPlacementHeight;
    const renderOrder = (selected ? count + 2 : count - index + 1) * 10 + 100;
    const handleSelect = useCallback(
        (event: { stopPropagation: () => void }) => {
            event.stopPropagation();
            onSelect(entry.slug);
        },
        [entry.slug, onSelect]
    );
    const handlePointerOver = useCallback((event: { stopPropagation: () => void }) => {
        event.stopPropagation();
        setHovered(true);
    }, []);
    const handlePointerOut = useCallback((event: { stopPropagation: () => void }) => {
        event.stopPropagation();
        setHovered(false);
    }, []);
    useCursor(hovered);

    useFrame(({ invalidate }, delta) => {
        const card = cardRef.current;
        let targetScale = 1;
        if (selected) {
            targetScale = 1.07;
        } else if (highlighted) {
            targetScale = 1.04;
        }
        const targetOffsetY = highlighted ? 0.04 : 0;
        const nextScale = MathUtils.damp(card.scale.x, targetScale, 14, delta);
        const nextOffsetY = MathUtils.damp(card.position.y, targetOffsetY, 14, delta);
        card.scale.setScalar(nextScale);
        card.position.y = nextOffsetY;
        if (
            Math.abs(nextScale - targetScale) > 0.001 ||
            Math.abs(nextOffsetY - targetOffsetY) > 0.001
        ) {
            invalidate();
        }
    });

    return (
        <Billboard position={[0, cardHeight / 2 + CARD_GAP_FROM_ORB, 0]}>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: The card is an interactive scene control. */}
            <group
                onClick={handleSelect}
                onPointerOut={handlePointerOut}
                onPointerOver={handlePointerOver}
                ref={cardRef}
            >
                <mesh
                    frustumCulled={false}
                    position={[0, -0.055, -0.014]}
                    renderOrder={renderOrder}
                    scale={[CARD_WIDTH + 0.08, cardHeight + 0.08, 1]}
                >
                    <primitive attach="geometry" object={CARD_PLANE_GEOMETRY} />
                    <primitive attach="material" object={cardShadowMaterial} />
                </mesh>
                {highlighted ? (
                    <mesh
                        frustumCulled={false}
                        position={[0, 0, -0.008]}
                        renderOrder={renderOrder + 1}
                        scale={[CARD_WIDTH + 0.06, cardHeight + 0.06, 1]}
                    >
                        <primitive attach="geometry" object={CARD_PLANE_GEOMETRY} />
                        <primitive
                            attach="material"
                            object={cardGlowMaterials[entry.contentType]}
                        />
                    </mesh>
                ) : null}
                <mesh
                    frustumCulled={false}
                    renderOrder={renderOrder + 2}
                    scale={[CARD_WIDTH, cardHeight, 1]}
                >
                    <primitive attach="geometry" object={CARD_PLANE_GEOMETRY} />
                    <primitive
                        attach="material"
                        object={
                            cardSurfaceMaterials[entry.contentType][
                                highlighted ? "highlighted" : "idle"
                            ]
                        }
                    />
                </mesh>
                <mesh
                    frustumCulled={false}
                    position={[0, posterPositionY, 0.012]}
                    renderOrder={renderOrder + 4}
                    scale={[POSTER_WIDTH, POSTER_HEIGHT, 1]}
                >
                    <primitive attach="geometry" object={CARD_PLANE_GEOMETRY} />
                    <primitive attach="material" object={posterFrameMaterial} />
                </mesh>
                <PosterArtwork
                    entry={entry}
                    posterPositionY={posterPositionY}
                    renderOrder={renderOrder + 5}
                />
                <mesh
                    frustumCulled={false}
                    position={[0, posterPositionY, 0.022]}
                    renderOrder={renderOrder + 6}
                    scale={[POSTER_WIDTH - 0.018, POSTER_HEIGHT - 0.018, 1]}
                >
                    <primitive attach="geometry" object={CARD_PLANE_GEOMETRY} />
                    <primitive attach="material" object={posterShadeMaterial} />
                </mesh>
                <Text
                    anchorX="left"
                    anchorY="top"
                    color={cardAccentColours[entry.contentType]}
                    fillOpacity={highlighted ? 1 : 0.9}
                    font={GEIST_MONO_FONT_URL}
                    fontSize={META_FONT_SIZE}
                    frustumCulled={false}
                    letterSpacing={0.1}
                    maxWidth={CARD_TEXT_WIDTH}
                    position={[META_LEFT, metaTop, 0.026]}
                    ref={configureOverlayMesh}
                    renderOrder={renderOrder + 7}
                    whiteSpace="nowrap"
                >
                    {contentTypeNames[entry.contentType].toUpperCase()}
                </Text>
                <Text
                    anchorX="left"
                    anchorY="top"
                    color="#f4f1e8"
                    fillOpacity={0.34}
                    font={GEIST_MONO_FONT_URL}
                    fontSize={META_FONT_SIZE}
                    frustumCulled={false}
                    letterSpacing={0.1}
                    lineHeight={1.3}
                    maxWidth={CARD_TEXT_WIDTH}
                    position={[META_LEFT, placementTop, 0.026]}
                    ref={configureOverlayMesh}
                    renderOrder={renderOrder + 7}
                    whiteSpace="nowrap"
                >
                    {formattedPlacement}
                </Text>
                <Text
                    anchorX="left"
                    anchorY="top"
                    color="#f4f1e8"
                    fillOpacity={highlighted ? 1 : 0.7}
                    font={GEIST_FONT_URL}
                    fontSize={TITLE_FONT_SIZE}
                    fontWeight={700}
                    frustumCulled={false}
                    letterSpacing={-0.01}
                    lineHeight={1.3}
                    maxWidth={CARD_TEXT_WIDTH}
                    overflowWrap="normal"
                    position={[META_LEFT, titleTop, 0.026]}
                    ref={configureOverlayMesh}
                    renderOrder={renderOrder + 7}
                    whiteSpace="nowrap"
                >
                    {formattedTitle}
                </Text>
            </group>
        </Billboard>
    );
}

// The node keeps its orb and GPU card together so their interactions select the same entry.
function TimelineNode({ active, count, entry, index, onSelect, selected }: TimelineNodeProps) {
    const ringsRef = useRef(new Group());
    const position = timelineNodePosition(index, count);
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
            <TimelinePosterCard
                active={active}
                count={count}
                entry={entry}
                index={index}
                onSelect={onSelect}
                selected={selected}
            />
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

interface MutableVectorRef {
    current: Vector3;
}

function updateFocusPosition(
    camera: Camera,
    controls: TargetableControls | null,
    destination: MutableVectorRef,
    delta: number
): boolean {
    if (!Number.isFinite(destination.current.x)) {
        return false;
    }

    if (controls) {
        const previousTarget = controls.target.clone();
        controls.target.x = MathUtils.damp(controls.target.x, destination.current.x, 7, delta);
        controls.target.y = MathUtils.damp(controls.target.y, destination.current.y, 7, delta);
        controls.target.z = MathUtils.damp(controls.target.z, destination.current.z, 7, delta);
        camera.position.add(controls.target.clone().sub(previousTarget));
        if (controls.target.distanceTo(destination.current) < 0.01) {
            destination.current.set(Number.NaN, Number.NaN, Number.NaN);
        }
    } else {
        camera.position.x = MathUtils.damp(camera.position.x, destination.current.x, 7, delta);
        camera.position.y = MathUtils.damp(camera.position.y, destination.current.y, 7, delta);
        camera.position.z = MathUtils.damp(camera.position.z, destination.current.z, 7, delta);
        if (camera.position.distanceTo(destination.current) < 0.01) {
            destination.current.set(Number.NaN, Number.NaN, Number.NaN);
        }
    }

    return Number.isFinite(destination.current.x);
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
    focusPosition: Vector3;
    initialPosition: Vector3;
    onZoomDistanceChange: (distance: number) => void;
    sceneKey: string;
    zoomDistance: number;
}

function CameraRig({
    focusKey,
    focusPosition,
    initialPosition,
    onZoomDistanceChange,
    sceneKey,
    zoomDistance,
}: CameraRigProps) {
    const camera = useThree((state) => state.camera);
    const controls = useThree((state) => state.controls);
    const invalidate = useThree((state) => state.invalidate);
    const destination = useRef(new Vector3(Number.NaN, Number.NaN, Number.NaN));
    const targetZoomDistance = useRef(zoomDistance);
    const appliedZoomDistance = useRef(Number.NaN);
    const cameraOffset = useRef(new Vector3());
    const appliedSceneKey = useRef("");

    useEffect(() => {
        destination.current.copy(focusPosition);
        invalidate();
    }, [focusKey, focusPosition, invalidate]);

    useEffect(() => {
        targetZoomDistance.current = zoomDistance;
        invalidate();
    }, [invalidate, zoomDistance]);

    useFrame((_, delta) => {
        const timelineControls = isTargetableControls(controls) ? controls : null;
        if (timelineControls && appliedSceneKey.current !== sceneKey) {
            const resetDistance = MathUtils.clamp(
                targetZoomDistance.current,
                MIN_ZOOM_DISTANCE,
                MAX_ZOOM_DISTANCE
            );
            timelineControls.target.copy(initialPosition);
            camera.position.set(
                initialPosition.x,
                initialPosition.y,
                initialPosition.z + resetDistance
            );
            timelineControls.update();
            appliedZoomDistance.current = resetDistance;
            appliedSceneKey.current = sceneKey;
            destination.current.set(Number.NaN, Number.NaN, Number.NaN);
        }
        if (!(timelineControls || Number.isFinite(destination.current.x))) {
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
    focusIndex: number;
    focusKey: number;
    focusPosition: Vector3;
    onInteractionChange: (interacting: boolean) => void;
    onSelect: (slug: string) => void;
    onZoomDistanceChange: (distance: number) => void;
    reducedMotion: boolean;
    sceneKey: string;
    selectedSlug?: string;
    zoomDistance: number;
}

function TimelineScene({
    compact,
    entries,
    focusIndex,
    focusKey,
    focusPosition,
    onInteractionChange,
    onSelect,
    reducedMotion,
    selectedSlug,
    onZoomDistanceChange,
    zoomDistance,
    sceneKey,
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
    const handleInteractionStart = useCallback(
        () => onInteractionChange(true),
        [onInteractionChange]
    );
    const handleInteractionEnd = useCallback(
        () => onInteractionChange(false),
        [onInteractionChange]
    );

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
                    active={index === focusIndex}
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
                onEnd={handleInteractionEnd}
                onStart={handleInteractionStart}
                zoomSpeed={0.7}
            />
            <CameraRig
                focusKey={focusKey}
                focusPosition={focusPosition}
                initialPosition={focusPosition}
                onZoomDistanceChange={onZoomDistanceChange}
                sceneKey={sceneKey}
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
    const [interacting, setInteracting] = useState(false);
    const [zoomDistance, setZoomDistance] = useState(DEFAULT_ZOOM_DISTANCE);
    const [zoomStorageReady, setZoomStorageReady] = useState(false);
    const interactionEndTimer = useRef<number | null>(null);
    const cameraSettings = useMemo(
        () => ({ fov: 43, position: [0, 0, 10.5] as [number, number, number] }),
        []
    );
    const sceneKey = useMemo(() => entries.map((entry) => entry.slug).join("|"), [entries]);
    const safeFocusIndex = Math.min(Math.max(focusIndex, 0), Math.max(entries.length - 1, 0));
    const focusPosition = useMemo(() => {
        const nodePosition = timelineNodePosition(safeFocusIndex, entries.length);
        return new Vector3(
            nodePosition.x,
            nodePosition.y + TIMELINE_CARD_FOCUS_OFFSET_Y,
            nodePosition.z
        );
    }, [entries.length, safeFocusIndex]);
    const handleZoomDistanceChange = useCallback((nextDistance: number) => {
        const roundedDistance = Math.round(nextDistance * 10) / 10;
        setZoomDistance((current) =>
            Math.abs(current - roundedDistance) < 0.05 ? current : roundedDistance
        );
    }, []);
    const handleInteractionChange = useCallback((nextInteracting: boolean) => {
        if (interactionEndTimer.current !== null) {
            window.clearTimeout(interactionEndTimer.current);
            interactionEndTimer.current = null;
        }
        if (nextInteracting) {
            setInteracting(true);
            return;
        }
        interactionEndTimer.current = window.setTimeout(() => {
            setInteracting(false);
            interactionEndTimer.current = null;
        }, 300);
    }, []);

    useEffect(
        () => () => {
            if (interactionEndTimer.current !== null) {
                window.clearTimeout(interactionEndTimer.current);
            }
        },
        []
    );

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
                <p className="font-mono text-[0.7rem] text-white/35 uppercase tracking-[0.2em]">
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
                camera={cameraSettings}
                dpr={compact || interacting ? 1 : [1, 1.5]}
                frameloop={reducedMotion ? "demand" : "always"}
            >
                <Suspense fallback={null}>
                    <TimelineScene
                        compact={compact}
                        entries={entries}
                        focusIndex={safeFocusIndex}
                        focusKey={focusKey}
                        focusPosition={focusPosition}
                        onInteractionChange={handleInteractionChange}
                        onSelect={onSelect}
                        onZoomDistanceChange={handleZoomDistanceChange}
                        reducedMotion={reducedMotion}
                        sceneKey={sceneKey}
                        selectedSlug={selectedSlug}
                        zoomDistance={zoomDistance}
                    />
                </Suspense>
            </Canvas>
        </div>
    );
}
