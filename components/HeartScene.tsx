"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import {
  HEART_PARTS,
  type HeartPart,
  type HeartPartId,
} from "@/lib/heart-parts";

type HeartSceneProps = {
  selectedId: HeartPartId | null;
  onSelect: (id: HeartPartId | null) => void;
};

function HeartMesh({
  part,
  selected,
  onSelect,
}: {
  part: HeartPart;
  selected: boolean;
  onSelect: (id: HeartPartId) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const active = selected || hovered;

  return (
    <mesh
      position={part.position}
      rotation={part.rotation}
      scale={part.scale}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(part.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {part.shape === "chamber" ? (
        <sphereGeometry args={[0.7, 32, 24]} />
      ) : (
        <cylinderGeometry args={[1, 1, 1.4, 24]} />
      )}
      <meshStandardMaterial
        color={part.color}
        roughness={0.35}
        metalness={0.08}
        emissive={part.color}
        emissiveIntensity={active ? 0.35 : 0.04}
      />
    </mesh>
  );
}

function SchematicHeart({
  selectedId,
  onSelect,
}: HeartSceneProps) {
  return (
    <group>
      {HEART_PARTS.map((part) => (
        <HeartMesh
          key={part.id}
          part={part}
          selected={selectedId === part.id}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

export default function HeartScene({ selectedId, onSelect }: HeartSceneProps) {
  return (
    <Canvas
      camera={{ position: [3.8, 1.6, 6.2], fov: 40 }}
      dpr={[1, 2]}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#0f1724"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 8, 4]} intensity={1.4} />
      <directionalLight position={[-4, 2, -3]} intensity={0.35} />
      <SchematicHeart selectedId={selectedId} onSelect={onSelect} />
      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={12}
        target={[0, 0.2, 0]}
      />
    </Canvas>
  );
}
