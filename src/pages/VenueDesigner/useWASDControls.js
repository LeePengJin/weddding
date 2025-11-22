import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MOVE_SPEED = 0.3;

export function useWASDControls() {
  const { camera } = useThree();
  const keysRef = useRef({});

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle if not typing in an input/textarea
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

  useFrame(() => {
    const keys = keysRef.current;
    if (!keys['w'] && !keys['s'] && !keys['a'] && !keys['d'] && 
        !keys['arrowup'] && !keys['arrowdown'] && !keys['arrowleft'] && !keys['arrowright']) {
      return;
    }

    // Get camera direction vectors
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // Keep movement on horizontal plane
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
    right.normalize();

    const moveDirection = new THREE.Vector3();

    // Calculate movement direction based on keys
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

    // Normalize and apply speed
    if (moveDirection.length() > 0) {
      moveDirection.normalize();
      moveDirection.multiplyScalar(MOVE_SPEED);
      camera.position.add(moveDirection);
    }
  });
}

