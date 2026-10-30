"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { DirectionalLight, Object3D, Vector3 } from "three";
import { DEFAULT_TARGET } from "@/lib/heart-model";

/** Neutral, shadow-free illumination; the soft key follows the viewing angle. */
export default function HeartLighting() {
  const key = useRef<DirectionalLight>(null);
  const target = useMemo(() => {
    const object = new Object3D();
    object.position.fromArray(DEFAULT_TARGET);
    return object;
  }, []);
  const offset = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    // Offset above/left of the eye retains relief without leaving the reverse
    // surface in shadow when the student rotates underneath or behind the heart.
    offset.set(-2, 3, 0).applyQuaternion(camera.quaternion);
    key.current?.position.copy(camera.position).add(offset);
  }, -.25);
  return <>
    <ambientLight intensity={1.3} />
    <hemisphereLight args={["#ffffff", "#d7d9dd", .8]} />
    <primitive object={target} />
    <directionalLight ref={key} target={target} intensity={2.2} />
    <directionalLight position={[-4, 1, -3]} intensity={.5} />
  </>;
}
