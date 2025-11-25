import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MOVE_SPEED_UNITS_PER_SECOND = 8;
const UP_AXIS = new THREE.Vector3(0, 1, 0);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function useWASDControls({ mode = 'orbit', bounds, firstPersonHeight = 1.75 } = {}) {
  const { camera, controls } = useThree((state) => ({
    camera: state.camera,
    controls: state.controls,
  }));
  const keysRef = useRef({});
  const forwardRef = useRef(new THREE.Vector3());
  const rightRef = useRef(new THREE.Vector3());
  const moveRef = useRef(new THREE.Vector3());

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }
      keysRef.current[event.key.toLowerCase()] = true;
    };

    const handleKeyUp = (event) => {
      keysRef.current[event.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (mode === 'walk') {
      camera.position.y = firstPersonHeight;
    } else if (bounds) {
      camera.position.y = clamp(camera.position.y, bounds.minY ?? camera.position.y, bounds.maxY ?? camera.position.y);
    }
  }, [camera, firstPersonHeight, mode, bounds]);

  useFrame((_, delta) => {
    if (mode === 'disabled') return;
    const keys = keysRef.current;
    const isMoving =
      keys['w'] ||
      keys['a'] ||
      keys['s'] ||
      keys['d'] ||
      keys['arrowup'] ||
      keys['arrowdown'] ||
      keys['arrowleft'] ||
      keys['arrowright'];

    if (!isMoving) {
      return;
    }

    const forward = forwardRef.current;
    forward.set(0, 0, 0);
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() === 0) {
      forward.z = -1;
    }
    forward.normalize();

    const right = rightRef.current;
    right.copy(forward).cross(UP_AXIS).normalize();

    const moveDirection = moveRef.current;
    moveDirection.set(0, 0, 0);

    if (keys['w'] || keys['arrowup']) {
      moveDirection.add(forward);
    }
    if (keys['s'] || keys['arrowdown']) {
      moveDirection.sub(forward);
    }
    if (keys['a'] || keys['arrowleft']) {
      moveDirection.sub(right);
    }
    if (keys['d'] || keys['arrowright']) {
      moveDirection.add(right);
    }

    if (moveDirection.lengthSq() === 0) {
      return;
    }

    moveDirection.normalize();
    const distance = MOVE_SPEED_UNITS_PER_SECOND * delta;
    moveDirection.multiplyScalar(distance);

    const nextPosition = camera.position.clone().add(moveDirection);

    if (bounds) {
      nextPosition.x = clamp(nextPosition.x, bounds.minX, bounds.maxX);
      nextPosition.z = clamp(nextPosition.z, bounds.minZ, bounds.maxZ);
      if (mode === 'walk') {
        nextPosition.y = firstPersonHeight;
      } else {
        nextPosition.y = clamp(nextPosition.y, bounds.minY, bounds.maxY);
      }
    } else if (mode === 'walk') {
      nextPosition.y = firstPersonHeight;
    }

    camera.position.copy(nextPosition);

    if (controls?.target) {
      const nextTarget = controls.target.clone().add(moveDirection);
      if (bounds) {
        nextTarget.x = clamp(nextTarget.x, bounds.minX, bounds.maxX);
        nextTarget.z = clamp(nextTarget.z, bounds.minZ, bounds.maxZ);
        nextTarget.y = clamp(nextTarget.y, bounds.minY, bounds.maxY);
      }
      controls.target.copy(nextTarget);
      controls.update?.();
    }
  });
}

