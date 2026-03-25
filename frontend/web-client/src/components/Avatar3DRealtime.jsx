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
  avatarUrl,
  isSpeaking,
  isListening,
  analyserRef,
  currentText,
  audioRef,
  pipelineStage,
  ...props
}) {
  // ── Load model (dynamic URL with fallback) ──
  const modelUrl = avatarUrl || '/avatars/avatar.glb';
  const gltfAvatar = useGLTF(modelUrl);
  const scene = gltfAvatar.scene;
  const animations = gltfAvatar.animations || [];

  // ═══ LAYER 1: NORMALIZE MODEL ORIENTATION ═══
  // Different GLB models may have different root rotations.
  // Force the scene to upright orientation on load.
  useEffect(() => {
    if (!scene) return;
    // Reset root transform to ensure consistent orientation
    scene.rotation.set(0, 0, 0);
    scene.position.set(0, 0, 0);
    scene.scale.set(1, 1, 1);
    console.log(`[Avatar3D] Model loaded: ${modelUrl}`);

    // Layer 8: Debug — log all bones and their rest rotations
    const boneList = [];
    scene.traverse((child) => {
      if (child.isBone) {
        boneList.push({
          name: child.name,
          rx: child.rotation.x.toFixed(3),
          ry: child.rotation.y.toFixed(3),
          rz: child.rotation.z.toFixed(3),
        });
      }
    });
    console.log(`[Avatar3D] Bones (${boneList.length}):`, boneList.map(b => `${b.name}(${b.rx},${b.ry},${b.rz})`).join(', '));
  }, [scene, modelUrl]);

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

  // Set active animation based on speaking state
  useEffect(() => {
    const isMale = modelUrl?.includes("male");
    const isFemale = modelUrl?.includes("female");
    
    if (isMale && actions["still"] && actions["handwaving"]) {
      setAnimation(isSpeaking ? "handwaving" : "still");
    } else if (isFemale && actions["still_f"] && actions["handwaving_f"]) {
      setAnimation(isSpeaking ? "handwaving_f" : "still_f");
    } else {
      if (animations.length > 0) setAnimation(animations[0].name);
    }
  }, [isSpeaking, modelUrl, actions, animations]);

  // Handle cross-fading base animations
  useEffect(() => {
    if (!animation || Object.keys(actions).length === 0) return;
    const action = actions[animation] || Object.values(actions)[0];
    if (action) {
      action.reset().fadeIn(0.3).play();
      return () => action.fadeOut(0.3);
    }
  }, [animation, actions]);

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
      // Upper arms
      if (n.includes("leftupperarm") || n.includes("left_upper_arm") || n.includes("upperarm_l") || (n.includes("upper") && n.includes("arm") && n.includes("left")))
        result.leftUpperArm = child;
      if (n.includes("rightupperarm") || n.includes("right_upper_arm") || n.includes("upperarm_r") || (n.includes("upper") && n.includes("arm") && n.includes("right")))
        result.rightUpperArm = child;
      // Shoulders
      if (n.includes("leftshoulder") || n.includes("left_shoulder") || n.includes("shoulder_l"))
        result.leftShoulder = child;
      if (n.includes("rightshoulder") || n.includes("right_shoulder") || n.includes("shoulder_r"))
        result.rightShoulder = child;
      // Forearms (Layer 2)
      if (n.includes("leftforearm") || n.includes("left_forearm") || n.includes("forearm_l") || (n.includes("forearm") && n.includes("left")))
        result.leftForeArm = child;
      if (n.includes("rightforearm") || n.includes("right_forearm") || n.includes("forearm_r") || (n.includes("forearm") && n.includes("right")))
        result.rightForeArm = child;
    });
    if (Object.keys(result).length > 0) {
      console.log("[Avatar3D] Arm bones:", Object.keys(result));
    }
    return result;
  }, [scene]);

  // Store initial bone transforms
  // LAYER 2: Store per-model, so we capture the actual rest pose of THIS specific GLB.
  const initialBoneRots = useRef({});
  const boneInitLogged = useRef(false);
  useEffect(() => {
    // Clear on model change so we re-capture for the new GLB
    initialBoneRots.current = {};
    boneInitLogged.current = false;
  }, [modelUrl]);

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
    // Debug log initial rotations once per model load
    if (!boneInitLogged.current && Object.keys(initialBoneRots.current).length > 0) {
      boneInitLogged.current = true;
      const summary = Object.entries(initialBoneRots.current).map(([k, v]) =>
        `${k}(${v.rotation.x.toFixed(2)},${v.rotation.y.toFixed(2)},${v.rotation.z.toFixed(2)})`
      ).join(', ');
      console.log(`[Avatar3D] Initial bone rotations for ${modelUrl}:`, summary);
    }
  }, [jawBone, headBone, neckBone, spineBones, armBones, modelUrl]);

  // ═══ ADDITIVE TARGET-BASED GESTURE SYSTEM ═══
  // Layer 2: Persistent target offsets (what we WANT) and current offsets (what we HAVE)
  // These are additive Euler offsets applied ON TOP OF whatever the base animation gives us.
  // STRICT RULE: NO head, neck, or jaw bones here — face is lip-sync ONLY.
  const targetOffsets = useRef({
    leftUpperArm:   [0, 0, 0],
    rightUpperArm:  [0, 0, 0],
    leftForeArm:    [0, 0, 0],
    rightForeArm:   [0, 0, 0],
    leftShoulder:   [0, 0, 0],
    rightShoulder:  [0, 0, 0],
  });
  const currentOffsets = useRef({
    leftUpperArm:   [0, 0, 0],
    rightUpperArm:  [0, 0, 0],
    leftForeArm:    [0, 0, 0],
    rightForeArm:   [0, 0, 0],
    leftShoulder:   [0, 0, 0],
    rightShoulder:  [0, 0, 0],
  });
  // Spine offsets (separate because variable count)
  const spineTargetOffsets = useRef([]);
  const spineCurrentOffsets = useRef([]);

  // Initialize spine offset arrays when bones change
  useEffect(() => {
    if (spineBones.length > 0 && spineTargetOffsets.current.length !== spineBones.length) {
      spineTargetOffsets.current = spineBones.map(() => [0, 0, 0]);
      spineCurrentOffsets.current = spineBones.map(() => [0, 0, 0]);
    }
  }, [spineBones]);

  // ─── STATE-BASED GESTURE MACHINE ───
  // States: 'idle' | 'raising' | 'hold' | 'returning' | 'cooldown'
  const gestureRef = useRef({
    state: 'idle',
    stateStartTime: 0,
    holdDuration: 0,      // how long to hold (0.8-1.2s)
    cooldownEnd: 0,       // when cooldown expires (allows re-trigger)
    gestureCount: 0,      // how many gestures fired this speech session
    wasSpeaking: false,   // edge detection for speech start
  });

  // Speech-aware response intensity heuristic (Layer 7)
  const gestureIntensityRef = useRef(1.0);
  useEffect(() => {
    if (!currentText) { gestureIntensityRef.current = 0.3; return; }
    const len = currentText.trim().length;
    if (len < 80) gestureIntensityRef.current = 0.5;
    else if (len < 200) gestureIntensityRef.current = 0.8;
    else gestureIntensityRef.current = 1.0;
  }, [currentText]);

  // ═══ PERFORMANCE — fast morph target update (no scene.traverse) ═══
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

  // Pre-allocated quaternion + euler (zero GC, Layer 9)
  const _addQuat = useMemo(() => new THREE.Quaternion(), []);
  const _addEuler = useMemo(() => new THREE.Euler(), []);

  // Layer 3 & 6: Apply additive offset AFTER base animation has written the bone
  // LAYER 1: Forward-only clamp — prevents backward arm motion
  const applyAdditiveOffset = (bone, current, clampConfig) => {
    if (!bone) return;
    // Default: forward-only on X (0 to +max), symmetric on Y, forward on Z
    const cfg = clampConfig || { xMin: 0, xMax: 0.3, yMax: 0.15, zMin: 0, zMax: 0.2 };
    const cx = THREE.MathUtils.clamp(current[0], cfg.xMin, cfg.xMax);
    const cy = THREE.MathUtils.clamp(current[1], -cfg.yMax, cfg.yMax);
    const cz = THREE.MathUtils.clamp(current[2], cfg.zMin, cfg.zMax);
    // Build a quaternion from the clamped euler offset
    _addQuat.setFromEuler(_addEuler.set(cx, cy, cz));
    // Multiply onto whatever the animation clip set this frame
    bone.quaternion.multiply(_addQuat);
  };

  // Per-bone clamp configs (Layer 1 + 3)
  const CLAMP_ARM      = { xMin: 0, xMax: 0.35, yMax: 0.12, zMin: 0, zMax: 0.1 };
  const CLAMP_FOREARM  = { xMin: 0, xMax: 0.1,  yMax: 0.05, zMin: 0, zMax: 0.25 };
  const CLAMP_SHOULDER = { xMin: 0, xMax: 0.05, yMax: 0.05, zMin: 0, zMax: 0.08 };

  // Layer 3: Lerp a current offset array toward a target offset array
  const lerpOffset = (current, target, speed) => {
    current[0] += (target[0] - current[0]) * speed;
    current[1] += (target[1] - current[1]) * speed;
    current[2] += (target[2] - current[2]) * speed;
  };

  // ─── Per-frame update ───
  useFrame((state) => {
    if (morphMeshesRef.current.length === 0) return;
    const time = state.clock.elapsedTime;
    const phonemes = phonemesRef.current;
    const totalDuration = audioDurationRef.current;
    const tgt = targetOffsets.current;
    const cur = currentOffsets.current;
    const LERP_SPEED = 0.08;  // smooth convergence
    const DECAY = 0.985;      // Layer 5: slow decay — holds gesture longer before fading

    // ═══ EXPRESSION BLENDING (face only, never touch visemes) ═══
    const expressionKey = emotionToExpression[emotion] || "default";
    const expressionMap = facialExpressions[expressionKey] || {};

    morphTargets.forEach((key) => {
      if (key === "eyeBlinkLeft" || key === "eyeBlinkRight") return;
      if (VISEME_TARGETS.has(key)) return;
      lerpMorphTarget(key, expressionMap[key] || 0, 0.1);
    });

    // Listening expression
    if (pipelineStage === 'thinking') {
      lerpMorphTarget("browInnerUp", 0.4, 0.1);
      lerpMorphTarget("mouthSmile", 0.1, 0.1);
    } else if (isListening && !isSpeaking) {
      lerpMorphTarget("browInnerUp", 0.25, 0.08);
      lerpMorphTarget("eyeWideLeft", 0.15, 0.08);
      lerpMorphTarget("eyeWideRight", 0.15, 0.08);
    }

    // ═══ BLINKING ═══
    lerpMorphTarget("eyeBlinkLeft", blink ? 1 : 0, 0.5);
    lerpMorphTarget("eyeBlinkRight", blink ? 1 : 0, 0.5);

    // ═══ AUDIO-DRIVEN MULTILINGUAL LIP SYNC (untouched) ═══
    if (isSpeaking) {
      const audio = audioRef?.current;
      const currentTime = audio ? audio.currentTime || 0 : 0;
      const effectiveDuration = totalDuration > 0 ? totalDuration : (audio?.duration || 1);
      const phonemeCount = phonemes.length;

      let currentViseme = "viseme_sil";
      if (phonemeCount > 0 && effectiveDuration > 0) {
        const currentIndex = Math.floor(
          (currentTime / effectiveDuration) * phonemeCount
        );

        if (currentIndex >= 0 && currentIndex < phonemeCount) {
          const phoneme = phonemes[currentIndex]?.phoneme;
          if (phoneme && phoneme !== "SIL") {
            currentViseme = visemesMapping[phoneme] || "viseme_aa";
          }
        }

        if (!syncLoggedRef.current) {
          syncLoggedRef.current = true;
          console.log(
            `[Avatar3D] LipSync: ${phonemeCount} phonemes, ` +
            `dur=${effectiveDuration.toFixed(2)}s, ` +
            `tpp=${(effectiveDuration / phonemeCount).toFixed(3)}s`
          );
        }
      }

      const isMale = modelUrl?.includes("male");
      const lipSyncScale = isMale ? 0.6 : 1.0;

      for (const key of VISEME_TARGETS) {
        if (key === currentViseme) {
          lerpMorphTarget(key, 0.9 * lipSyncScale, 0.2);
        } else if (key === "jawOpen") {
          // Separate jaw treatment below
        } else if (key === "mouthOpen") {
          lerpMorphTarget(key, currentViseme !== "viseme_sil" ? 0.35 * lipSyncScale : 0, 0.2);
        } else {
          lerpMorphTarget(key, 0, 0.15);
        }
      }

      const baseJaw = 0.2 * lipSyncScale + Math.sin(time * 8) * 0.1 * lipSyncScale;
      const visemeJaw = currentViseme !== "viseme_sil" ? 0.5 * lipSyncScale : 0.1 * lipSyncScale;
      lerpMorphTarget("jawOpen", Math.max(baseJaw, visemeJaw), 0.2);

      if (jawBone && initialBoneRots.current.jawBone) {
        let jawAmount = baseJaw * 0.3;
        if (analyserRef?.current && dataArrayRef.current) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          const d = dataArrayRef.current;
          const lo = (d[1] + d[2] + d[3] + d[4] + d[5]) / 5;
          const mid = (d[6] + d[7] + d[8] + d[9] + d[10] + d[11] + d[12] + d[13]) / 8;
          jawAmount = Math.min((lo * 0.8 + mid * 0.8) / 100, 1.0) * 0.25 * lipSyncScale;
        }
        const initX = initialBoneRots.current.jawBone.rotation.x;
        jawBone.rotation.x += ((initX + jawAmount) - jawBone.rotation.x) * 0.3;
      }

      // Ensure Head and Neck are locked looking forward during speech
      if (headBone && initialBoneRots.current.headBone) {
        headBone.rotation.x += (initialBoneRots.current.headBone.rotation.x - headBone.rotation.x) * 0.1;
        headBone.rotation.y += (initialBoneRots.current.headBone.rotation.y - headBone.rotation.y) * 0.1;
        headBone.rotation.z += (initialBoneRots.current.headBone.rotation.z - headBone.rotation.z) * 0.1;
      }
      if (neckBone && initialBoneRots.current.neckBone) {
        neckBone.rotation.x += (initialBoneRots.current.neckBone.rotation.x - neckBone.rotation.x) * 0.1;
        neckBone.rotation.y += (initialBoneRots.current.neckBone.rotation.y - neckBone.rotation.y) * 0.1;
        neckBone.rotation.z += (initialBoneRots.current.neckBone.rotation.z - neckBone.rotation.z) * 0.1;
      }

      // ═══ STATE-BASED GESTURE MACHINE ═══
      // Only run procedural gestures for female (male uses baked 'handwaving' now)
      if (!isMale) {
      const g = gestureRef.current;
      const amp = gestureIntensityRef.current;

      // LAYER 3: Detect speech START edge (trigger gesture once)
      if (!g.wasSpeaking) {
        // Speech just started — trigger first gesture
        g.wasSpeaking = true;
        g.gestureCount = 0;
        g.state = 'raising';
        g.stateStartTime = time;
        g.holdDuration = 0.8 + Math.random() * 0.4; // 0.8-1.2s hold

        // Pick a random gesture (set targets once, not every frame)
        const gestType = Math.floor(Math.random() * 4) + 1;
        const i = (0.4 + Math.random() * 0.3) * amp;

        if (gestType === 1) {       // right arm forward explain
          tgt.rightUpperArm = [ i * 0.30,  0,           0];
          tgt.rightForeArm  = [ 0,          0,          i * 0.20];
          tgt.leftUpperArm  = [ i * 0.05,  0,           0];
          tgt.leftForeArm   = [ 0,          0,          i * 0.03];
        } else if (gestType === 2) { // left arm forward explain
          tgt.leftUpperArm  = [ i * 0.25,  i * 0.06,    0];
          tgt.leftForeArm   = [ 0,          0,          i * 0.18];
          tgt.rightUpperArm = [ i * 0.04,  0,            0];
          tgt.rightForeArm  = [ 0,          0,          i * 0.02];
        } else if (gestType === 3) { // both arms open (asymmetric)
          tgt.leftUpperArm  = [ i * 0.22,  i * 0.06,    0];
          tgt.rightUpperArm = [ i * 0.15,  0,            0];
          tgt.leftForeArm   = [ 0,          0,           i * 0.14];
          tgt.rightForeArm  = [ 0,          0,           i * 0.09];
        } else {                     // right arm outward explain
          tgt.rightUpperArm = [ i * 0.20,  i * 0.08,    0];
          tgt.rightForeArm  = [ 0,          0,          i * 0.15];
          tgt.leftUpperArm  = [ i * 0.03,  0,            0];
          tgt.leftForeArm   = [ 0,          0,          i * 0.02];
        }
        tgt.leftShoulder  = [0, 0, tgt.leftUpperArm[1]  * 0.1];
        tgt.rightShoulder = [0, 0, tgt.rightUpperArm[1] * 0.1];
        g.gestureCount++;
      }

      // LAYER 4: State machine transitions (no looping, no Math.sin)
      const elapsed = time - g.stateStartTime;

      if (g.state === 'raising') {
        // Targets already set — lerp (in LERP section below) moves current toward target.
        // Transition to HOLD after current ~reaches target (~0.5s)
        if (elapsed > 0.5) {
          g.state = 'hold';
          g.stateStartTime = time;
        }
      } else if (g.state === 'hold') {
        // LAYER 4 step 2: Hold position for holdDuration (targets unchanged)
        if (elapsed > g.holdDuration) {
          g.state = 'returning';
          g.stateStartTime = time;
          // Zero all targets — lerp will smoothly bring current back to 0
          for (const key in tgt) {
            tgt[key][0] = 0;
            tgt[key][1] = 0;
            tgt[key][2] = 0;
          }
        }
      } else if (g.state === 'returning') {
        // Lerp moves current toward zero. Once done, enter cooldown.
        if (elapsed > 0.6) {
          g.state = 'cooldown';
          g.stateStartTime = time;
          g.cooldownEnd = time + 2.0 + Math.random() * 2.0; // 2-4s cooldown
        }
      } else if (g.state === 'cooldown') {
        // LAYER 8: Allow ONE more gesture after cooldown (for long speech)
        if (time > g.cooldownEnd && g.gestureCount < 3) {
          g.state = 'raising';
          g.stateStartTime = time;
          g.holdDuration = 0.8 + Math.random() * 0.4;

          // Pick a NEW gesture for the re-trigger
          const gestType = Math.floor(Math.random() * 4) + 1;
          const i = (0.4 + Math.random() * 0.3) * amp;

          if (gestType === 1) {
            tgt.rightUpperArm = [ i * 0.30,  0,           0];
            tgt.rightForeArm  = [ 0,          0,          i * 0.20];
            tgt.leftUpperArm  = [ i * 0.05,  0,           0];
            tgt.leftForeArm   = [ 0,          0,          i * 0.03];
          } else if (gestType === 2) {
            tgt.leftUpperArm  = [ i * 0.25,  i * 0.06,    0];
            tgt.leftForeArm   = [ 0,          0,          i * 0.18];
            tgt.rightUpperArm = [ i * 0.04,  0,            0];
            tgt.rightForeArm  = [ 0,          0,          i * 0.02];
          } else if (gestType === 3) {
            tgt.leftUpperArm  = [ i * 0.22,  i * 0.06,    0];
            tgt.rightUpperArm = [ i * 0.15,  0,            0];
            tgt.leftForeArm   = [ 0,          0,           i * 0.14];
            tgt.rightForeArm  = [ 0,          0,           i * 0.09];
          } else {
            tgt.rightUpperArm = [ i * 0.20,  i * 0.08,    0];
            tgt.rightForeArm  = [ 0,          0,          i * 0.15];
            tgt.leftUpperArm  = [ i * 0.03,  0,            0];
            tgt.leftForeArm   = [ 0,          0,          i * 0.02];
          }
          tgt.leftShoulder  = [0, 0, tgt.leftUpperArm[1]  * 0.1];
          tgt.rightShoulder = [0, 0, tgt.rightUpperArm[1] * 0.1];
          g.gestureCount++;
        }
      }
      }
      // END procedural female gestures
      // In 'idle' state inside speaking block: do nothing (wait for state change)

    } else {
      // ═══ NOT SPEAKING — LAYER 7: Force return to rest ═══
      for (const key of VISEME_TARGETS) {
        lerpMorphTarget(key, 0, 0.12);
      }
      if (jawBone && initialBoneRots.current.jawBone) {
        const initX = initialBoneRots.current.jawBone.rotation.x;
        jawBone.rotation.x += (initX - jawBone.rotation.x) * 0.15;
      }
      // Reset gesture state machine
      const g = gestureRef.current;
      if (g.wasSpeaking) {
        g.wasSpeaking = false;
        g.state = 'idle';
        g.gestureCount = 0;
      }
      // Zero all targets — lerp brings arms back to rest
      for (const key in tgt) {
        tgt[key][0] = 0;
        tgt[key][1] = 0;
        tgt[key][2] = 0;
      }
      syncLoggedRef.current = false;
      
      // Let head slowly return to idle animation naturally when not speaking
    }

    // NO head/neck micro-movement — face is strictly lip-sync only (Layer 1)

    // ═══ SPINE: SAFE NON-ACCUMULATING SYSTEM ═══
    // Spine uses direct-set from initial rotation + tiny offset (NO multiply, NO +=)
    // This prevents the accumulation bug that causes infinite twisting.
    const SPINE_MAX = 0.03; // radians (~1.7 degrees) — extremely subtle
    for (let si = 0; si < spineBones.length; si++) {
      const bone = spineBones[si];
      const init = initialBoneRots.current[`spine${si}`];
      if (!bone || !init) continue;

      // Compute tiny breathing offset (clamped)
      const offX = THREE.MathUtils.clamp(Math.sin(time * 0.25 + si * 0.5) * 0.005, -SPINE_MAX, SPINE_MAX);
      const offY = THREE.MathUtils.clamp(Math.sin(time * 0.38 + si * 0.3) * 0.003, -SPINE_MAX, SPINE_MAX);

      // LAYER 4: Lerp toward (initialRotation + offset) — absolute set, never accumulate
      bone.rotation.x += ((init.rotation.x + offX) - bone.rotation.x) * 0.05;
      bone.rotation.y += ((init.rotation.y + offY) - bone.rotation.y) * 0.05;
      bone.rotation.z += ((init.rotation.z)        - bone.rotation.z) * 0.05;
    }

    // ═══ LERP arm/shoulder current offsets toward targets ═══
    for (const key in cur) {
      lerpOffset(cur[key], tgt[key], LERP_SPEED);
    }

    // ═══ APPLY ADDITIVE OFFSETS — ARMS AND SHOULDERS ONLY ═══
    // Procedural arm offsets only applied to female (male uses baked clips)
    if (!modelUrl?.includes("male")) {
      applyAdditiveOffset(armBones.leftUpperArm,  cur.leftUpperArm,  CLAMP_ARM);
      applyAdditiveOffset(armBones.rightUpperArm, cur.rightUpperArm, CLAMP_ARM);
      applyAdditiveOffset(armBones.leftForeArm,   cur.leftForeArm,   CLAMP_FOREARM);
      applyAdditiveOffset(armBones.rightForeArm,  cur.rightForeArm,  CLAMP_FOREARM);
      applyAdditiveOffset(armBones.leftShoulder,  cur.leftShoulder,  CLAMP_SHOULDER);
      applyAdditiveOffset(armBones.rightShoulder, cur.rightShoulder, CLAMP_SHOULDER);
    }
    // Spine handled above with direct-set. Hands/fingers NOT animated (follow naturally).

    // ═══ LAYER 12: STATE-BASED GROUP ANIMATION ═══
    if (group.current) {
      if (pipelineStage === 'thinking') {
        // Thinking: look up slightly, gentle sway
        group.current.rotation.y += (Math.sin(time * 0.3) * 0.05 - group.current.rotation.y) * 0.02;
        group.current.rotation.x += (-0.03 - group.current.rotation.x) * 0.02;
        group.current.position.y += (-0.5 - group.current.position.y) * 0.05;
      } else if (!isSpeaking && !isListening) {
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

// Preload both avatar models for fast switching (Layer 9)
useGLTF.preload('/avatars/male.glb');
useGLTF.preload('/avatars/female.glb');
useGLTF.preload('/avatars/avatar.glb');
