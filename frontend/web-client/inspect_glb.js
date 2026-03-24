import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as fs from 'fs';
import * as path from 'path';

// Define globals needed for three.js GLTFLoader outside browser
global.window = global;
global.document = {
  createElement: () => ({ setAttribute: () => {}, getElementsByTagName: () => [] })
};

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'public/models/avatar_realtime.glb');
const buffer = fs.readFileSync(filePath);
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  console.log('\n=== GLB Model Structure ===\n');
  
  gltf.scene.traverse((child) => {
    if (child.isMesh || child.isSkinnedMesh) {
      console.log(`Mesh: "${child.name}" | Type: ${child.type}`);
      if (child.morphTargetDictionary) {
        const targets = Object.keys(child.morphTargetDictionary);
        console.log(`  Morph Targets (${targets.length}):`, targets.join(', '));
      } else {
        console.log('  No morph targets');
      }
    }
  });
  console.log('\n=== Done ===');
}, (error) => {
  console.error('Error parsing GLB:', error);
});
