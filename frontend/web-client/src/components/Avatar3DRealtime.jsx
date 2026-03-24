import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import facialExpressions from "../constants/facialExpressions";
import morphTargets from "../constants/morphTargets";
import visemesMapping from "../constants/visemesMapping";
import { generatePhonemes } from "../utils/phonemeGenerator";
import { detectEmotion } from "../utils/emotionDetector";

// Morph targets driven by lip sync — expressions must NOT touch these
const VISEME_TARGETS = new Set([
  "mouthOpen", "jawOpen",
  "viseme_sil", "viseme_PP", "viseme_FF", "viseme_TH", "viseme_DD",
  "viseme_kk", "viseme_CH", "viseme_SS", "viseme_nn", "viseme_RR",
  "viseme_aa", "viseme_E", "viseme_I", "viseme_O", "viseme_U",
]);

/**
 * Avatar3DRealtime — Multilingual 3D avatar with audio-driven viseme lip sync,
 * emotion expressions, procedural body animation, and idle behaviors.
 *
 * Performance: morphTargetDictionary is cached once, not traversed every frame.
 */
export function Avatar3DRealtime({
  isSpeaking,
  isListening,
  analyserRef,
  currentText,
  audioRef,
  ...props
}) {
  // ── Load model ──
  const gltfAvatar = useGLTF("/avatars/avatar.glb");
  const scene = gltfAvatar.scene;
  const animations = gltfAvatar.animations || [];

  const group = useRef();
  const { actions, mixer } = useAnimations(animations, group);
  const [blink, setBlink] = useState(false);
  const dataArrayRef = useRef(null);
  const syncLoggedRef = useRef(false);

  // Stable refs for audio-driven lip sync
  const phonemesRef = useRef([]);
  const audioDurationRef = useRef(0);

  // ═══ LAYER 7: PERFORMANCE — Cache skinned meshes with morphs ═══
  const morphMeshesRef = useRef([]);
  useEffect(() => {
    if (!scene) return;
    const meshes = [];
    scene.traverse((child) => {
      if (child.isSkinnedMesh && child.morphTargetDictionary) {
        meshes.push({
          mesh: child,
          dict: child.morphTargetDictionary,
          influences: child.morphTargetInfluences,
        });
      }
    });
    morphMeshesRef.current = meshes;
    // Log once for debugging
    if (meshes.length > 0) {
      console.log(
        `[Avatar3D] Cached ${meshes.length} morph meshes:`,
        meshes.map((m) => `${m.mesh.name} (${Object.keys(m.dict).length} targets)`)
      );
    }
    console.log(
      "[Avatar3D] Animations:",
      animations.length > 0 ? animations.map((a) => a.name) : "None"
    );
  }, [scene, animations]);

  // Pick the first available animation
  const defaultAnimName = animations.length > 0 ? animations[0].name : null;
  const [animation, setAnimation] = useState(defaultAnimName);

  // ── Emotion derived from text ──
  const emotion = useMemo(
    () => (currentText ? detectEmotion(currentText) : "neutral"),
    [currentText]
  );

  // ── Generate phonemes from text (multilingual) ──
  const rawPhonemes = useMemo(() => {
    if (!currentText) return [];
    return generatePhonemes(currentText, 1);
  }, [currentText]);

  // ── Redistribute phonemes when audio loads ──
  useEffect(() => {
    syncLoggedRef.current = false;
    const audio = audioRef?.current;
    if (!audio || rawPhonemes.length === 0) {
      phonemesRef.current = rawPhonemes;
      audioDurationRef.current = 0;
      return;
    }
    const redistribute = (duration) => {
      if (!duration || !isFinite(duration) || duration <= 0) return;
      audioDurationRef.current = duration;
      const count = rawPhonemes.length;
      const tpp = duration / count;
      phonemesRef.current = rawPhonemes.map((p, i) => ({
        phoneme: p.phoneme,
        time: i * tpp,
      }));
      console.log(
        `[Avatar3D] Sync: ${count} phonemes, ${duration.toFixed(2)}s, ${tpp.toFixed(3)}s/phoneme`
      );
    };
    const onMeta = () => redistribute(audio.duration);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    if (audio.duration && isFinite(audio.duration)) redistribute(audio.duration);
    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
    };
  }, [audioRef?.current, rawPhonemes]);

  // Map emotion → expression key
  const emotionToExpression = {
    happy: "happy", serious: "serious", sad: "sad",
    surprised: "surprised", neutral: "default",
  };

  // Keep analyser data array in sync
  useEffect(() => {
    if (analyserRef?.current) {
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
    }
  }, [analyserRef?.current]);

  // Play first animation
  useEffect(() => {
    if (animations.length > 0) setAnimation(animations[0].name);
  }, [animations]);

  useEffect(() => {
    if (!animation || Object.keys(actions).length === 0) return;
    const action = actions[animation] || Object.values(actions)[0];
    if (action) {
      action.reset().fadeIn(mixer.stats.actions.inUse === 0 ? 0 : 0.5).play();
      return () => action.fadeOut(0.5);
    }
  }, [animation, actions, mixer]);

  // ── Discover bones ──
  const jawBone = useMemo(() => {
    if (!scene) return null;
    let found = null;
    scene.traverse((child) => {
      if (child.isBone) {
        const n = child.name.toLowerCase();
        if (n.includes("jaw")) found = child;
        else if (!found && n.includes("head")) found = child;
      }
    });
    return found;
  }, [scene]);

  const headBone = useMemo(() => {
    if (!scene) return null;
    let found = null;
    scene.traverse((child) => {
      if (child.isBone && child.name.toLowerCase().includes("head")) found = child;
    });
    return found;
  }, [scene]);

  const neckBone = useMemo(() => {
    if (!scene) return null;
    let found = null;
    scene.traverse((child) => {
      if (child.isBone && child.name.toLowerCase().includes("neck")) found = child;
    });
    return found;
  }, [scene]);

  const spineBones = useMemo(() => {
    if (!scene) return [];
    const bones = [];
    scene.traverse((child) => {
      if (child.isBone && child.name.toLowerCase().includes("spine")) bones.push(child);
    });
    return bones;
  }, [scene]);

  const armBones = useMemo(() => {
    if (!scene) return {};
    const result = {};
    scene.traverse((child) => {
      if (!child.isBone) return;
      const n = child.name.toLowerCase();
      if (n.includes("leftupperarm") || n.includes("left_upper_arm") || n.includes("upperarm_l") || (n.includes("upper") && n.includes("arm") && n.includes("left")))
        result.leftUpperArm = child;
      if (n.includes("rightupperarm") || n.includes("right_upper_arm") || n.includes("upperarm_r") || (n.includes("upper") && n.includes("arm") && n.includes("right")))
        result.rightUpperArm = child;
      if (n.includes("leftshoulder") || n.includes("left_shoulder") || n.includes("shoulder_l"))
        result.leftShoulder = child;
      if (n.includes("rightshoulder") || n.includes("right_shoulder") || n.includes("shoulder_r"))
        result.rightShoulder = child;
    });
    if (Object.keys(result).length > 0) {
      console.log("[Avatar3D] Arm bones:", Object.keys(result));
    }
    return result;
  }, [scene]);

  // Store initial bone transforms
  const initialBoneRots = useRef({});
  useEffect(() => {
    const allBones = { jawBone, headBone, neckBone, ...armBones };
    spineBones.forEach((b, i) => { allBones[`spine${i}`] = b; });
    Object.entries(allBones).forEach(([key, bone]) => {
      if (bone && !initialBoneRots.current[key]) {
        initialBoneRots.current[key] = {
          rotation: bone.rotation.clone(),
          quaternion: bone.quaternion.clone(),
        };
      }
    });
  }, [jawBone, headBone, neckBone, spineBones, armBones]);

  // ═══ LAYER 7: PERFORMANCE — fast morph target update (no scene.traverse) ═══
  const lerpMorphTarget = (target, value, speed = 0.1) => {
    const meshes = morphMeshesRef.current;
    for (let m = 0; m < meshes.length; m++) {
      const idx = meshes[m].dict[target];
      if (idx !== undefined) {
        const inf = meshes[m].influences;
        inf[idx] += (value - inf[idx]) * speed;
      }
    }
  };

  // Reusable quaternion objects (avoid GC pressure)
  const _targetQuat = useMemo(() => new THREE.Quaternion(), []);
  const _speechQuat = useMemo(() => new THREE.Quaternion(), []);
  const _euler = useMemo(() => new THREE.Euler(), []);

  // Helper: apply procedural bone rotation
  const applyBoneOffset = (boneName, bone, euler, slerpSpeed) => {
    const init = initialBoneRots.current[boneName]?.quaternion;
    if (!init) return;
    _targetQuat.copy(init);
    _speechQuat.setFromEuler(_euler.set(euler[0], euler[1], euler[2]));
    _targetQuat.multiply(_speechQuat);
    bone.quaternion.slerp(_targetQuat, slerpSpeed);
  };

  // ─── Per-frame update ───
  useFrame((state) => {
    if (morphMeshesRef.current.length === 0) return;
    const time = state.clock.elapsedTime;
    const phonemes = phonemesRef.current;
    const totalDuration = audioDurationRef.current;

    // ═══ LAYER 11: EXPRESSION BLENDING (face only, never touch visemes) ═══
    const expressionKey = emotionToExpression[emotion] || "default";
    const expressionMap = facialExpressions[expressionKey] || {};

    morphTargets.forEach((key) => {
      if (key === "eyeBlinkLeft" || key === "eyeBlinkRight") return;
      if (VISEME_TARGETS.has(key)) return;
      lerpMorphTarget(key, expressionMap[key] || 0, 0.1);
    });

    // Listening expression
    if (isListening && !isSpeaking) {
      lerpMorphTarget("browInnerUp", 0.25, 0.08);
      lerpMorphTarget("eyeWideLeft", 0.15, 0.08);
      lerpMorphTarget("eyeWideRight", 0.15, 0.08);
    }

    // ═══ LAYER 10: BLINKING ═══
    lerpMorphTarget("eyeBlinkLeft", blink ? 1 : 0, 0.5);
    lerpMorphTarget("eyeBlinkRight", blink ? 1 : 0, 0.5);

    // ═══ LAYERS 1-6: AUDIO-DRIVEN MULTILINGUAL LIP SYNC ═══
    if (isSpeaking) {
      const audio = audioRef?.current;
      const currentTime = audio ? audio.currentTime || 0 : 0;
      const effectiveDuration = totalDuration > 0 ? totalDuration : (audio?.duration || 1);
      const phonemeCount = phonemes.length;

      // ── LAYER 4: Audio-driven index ──
      let currentViseme = "viseme_sil";
      if (phonemeCount > 0 && effectiveDuration > 0) {
        const currentIndex = Math.floor(
          (currentTime / effectiveDuration) * phonemeCount
        );

        // ── LAYER 5: Prevent lip sync stop ──
        if (currentIndex >= 0 && currentIndex < phonemeCount) {
          const phoneme = phonemes[currentIndex]?.phoneme;
          if (phoneme && phoneme !== "SIL") {
            currentViseme = visemesMapping[phoneme] || "viseme_aa"; // fallback to open mouth
          }
        }
        // index >= count or < 0 → viseme_sil (natural end)

        // ── LAYER 13: Debug logging (once per session) ──
        if (!syncLoggedRef.current) {
          syncLoggedRef.current = true;
          console.log(
            `[Avatar3D] LipSync: ${phonemeCount} phonemes, ` +
            `dur=${effectiveDuration.toFixed(2)}s, ` +
            `tpp=${(effectiveDuration / phonemeCount).toFixed(3)}s`
          );
        }
      }

      // ── LAYER 6: Smooth viseme transitions ──
      for (const key of VISEME_TARGETS) {
        if (key === currentViseme) {
          lerpMorphTarget(key, 0.9, 0.2);
        } else if (key === "jawOpen") {
          // Separate jaw treatment below
        } else if (key === "mouthOpen") {
          lerpMorphTarget(key, currentViseme !== "viseme_sil" ? 0.35 : 0, 0.2);
        } else {
          // Gradual decay — NOT instant zero
          lerpMorphTarget(key, 0, 0.15);
        }
      }

      // ── LAYER 3: Base jaw oscillation (prevents dead face in any language) ──
      const baseJaw = 0.2 + Math.sin(time * 8) * 0.1;
      const visemeJaw = currentViseme !== "viseme_sil" ? 0.5 : 0.1;
      lerpMorphTarget("jawOpen", Math.max(baseJaw, visemeJaw), 0.2);

      // Jaw bone rotation from audio analyser
      if (jawBone && initialBoneRots.current.jawBone) {
        let jawAmount = baseJaw * 0.3;
        if (analyserRef?.current && dataArrayRef.current) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          const d = dataArrayRef.current;
          const lo = (d[1] + d[2] + d[3] + d[4] + d[5]) / 5;
          const mid = (d[6] + d[7] + d[8] + d[9] + d[10] + d[11] + d[12] + d[13]) / 8;
          jawAmount = Math.min((lo * 0.8 + mid * 0.8) / 100, 1.0) * 0.25;
        }
        const initX = initialBoneRots.current.jawBone.rotation.x;
        jawBone.rotation.x += ((initX + jawAmount) - jawBone.rotation.x) * 0.3;
      }

      // ═══ LAYER 8: HEAD MOVEMENT during speaking ═══
      if (headBone) {
        applyBoneOffset("headBone", headBone, [
          Math.sin(time * 2.0) * 0.02,
          Math.sin(time * 1.5) * 0.05,
          Math.sin(time * 0.8) * 0.015,
        ], 0.08);
      }

      // ═══ LAYER 9: ARM / SHOULDER / SPINE GESTURE ═══
      if (armBones.leftUpperArm) {
        applyBoneOffset("leftUpperArm", armBones.leftUpperArm, [
          Math.sin(time * 1.2) * 0.04, 0, Math.sin(time * 0.9) * 0.03,
        ], 0.05);
      }
      if (armBones.rightUpperArm) {
        applyBoneOffset("rightUpperArm", armBones.rightUpperArm, [
          Math.sin(time * 1.3 + 1) * 0.04, 0, -Math.sin(time * 1.0 + 0.5) * 0.03,
        ], 0.05);
      }
      if (armBones.leftShoulder) {
        applyBoneOffset("leftShoulder", armBones.leftShoulder, [
          0, 0, Math.sin(time * 0.7) * 0.02,
        ], 0.04);
      }
      if (armBones.rightShoulder) {
        applyBoneOffset("rightShoulder", armBones.rightShoulder, [
          0, 0, -Math.sin(time * 0.7 + 0.5) * 0.02,
        ], 0.04);
      }
      spineBones.forEach((bone, i) => {
        applyBoneOffset(`spine${i}`, bone, [
          0, Math.sin(time * 0.6 + i * 0.3) * 0.01, 0,
        ], 0.04);
      });

    } else {
      // ═══ NOT SPEAKING — gradual return to rest ═══
      for (const key of VISEME_TARGETS) {
        lerpMorphTarget(key, 0, 0.12);
      }
      if (jawBone && initialBoneRots.current.jawBone) {
        const initX = initialBoneRots.current.jawBone.rotation.x;
        jawBone.rotation.x += (initX - jawBone.rotation.x) * 0.15;
      }
      syncLoggedRef.current = false;
    }

    // ═══ LAYER 12: STATE-BASED GROUP ANIMATION ═══
    if (group.current) {
      if (!isSpeaking && !isListening) {
        // Idle: head sway + breathing
        group.current.rotation.y += (Math.sin(time * 0.4) * 0.015 - group.current.rotation.y) * 0.015;
        group.current.rotation.x += (Math.sin(time * 0.25) * 0.008 - group.current.rotation.x) * 0.015;
        group.current.position.y = -0.5 + Math.sin(time * 1.5) * 0.003;
      } else if (isListening && !isSpeaking) {
        // Listening: attentive lean
        group.current.rotation.y += (Math.sin(time * 0.5) * 0.008 - group.current.rotation.y) * 0.02;
        group.current.rotation.x += (0.005 - group.current.rotation.x) * 0.02;
        group.current.position.y += (-0.5 - group.current.position.y) * 0.05;
      } else {
        // Speaking: stable base
        group.current.rotation.y += (0 - group.current.rotation.y) * 0.02;
        group.current.rotation.x += (0 - group.current.rotation.x) * 0.02;
        group.current.position.y += (-0.5 - group.current.position.y) * 0.05;
      }
    }
  });

  // ── Random blinking (3–5s interval, 120ms duration) ──
  useEffect(() => {
    let blinkTimeout;
    const nextBlink = () => {
      blinkTimeout = setTimeout(() => {
        setBlink(true);
        setTimeout(() => { setBlink(false); nextBlink(); }, 120);
      }, THREE.MathUtils.randInt(3000, 5000));
    };
    nextBlink();
    return () => clearTimeout(blinkTimeout);
  }, []);

  return (
    <group {...props} dispose={null} ref={group} position={[0, -0.5, 0]}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/avatars/avatar.glb");
