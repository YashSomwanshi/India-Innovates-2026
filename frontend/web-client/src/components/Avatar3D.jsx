import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import facialExpressions from "../constants/facialExpressions";
import morphTargets from "../constants/morphTargets";

/**
 * Avatar3D — 3D animated avatar with real-time lip-sync driven by Web Audio analyser.
 *
 * Props:
 *   isSpeaking  — avatar is playing audio
 *   isListening — avatar is recording user
 *   analyserRef — shared Web Audio AnalyserNode ref from App.jsx
 */
export function Avatar3D({ isSpeaking, isListening, analyserRef, ...props }) {
  const { nodes, materials, scene } = useGLTF("/models/avatar.glb");
  const { animations } = useGLTF("/models/animations.glb");

  const group = useRef();
  const { actions, mixer } = useAnimations(animations, group);
  const [animation, setAnimation] = useState("Idle");
  const [blink, setBlink] = useState(false);
  const [facialExpression, setFacialExpression] = useState("default");
  const dataArrayRef = useRef(null);

  // Keep analyser data array in sync
  useEffect(() => {
    if (analyserRef?.current) {
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
    }
  }, [analyserRef?.current]);

  // Switch animation based on state
  useEffect(() => {
    if (isSpeaking) {
      // Alternate between talking animations
      const talkAnims = ["TalkingOne", "TalkingThree", "Talking"];
      const available = talkAnims.filter(a => animations.find(an => an.name === a));
      if (available.length > 0) {
        setAnimation(available[Math.floor(Math.random() * available.length)]);
      }
      setFacialExpression("smile");
    } else if (isListening) {
      setAnimation("Idle");
      setFacialExpression("default");
    } else {
      setAnimation("Idle");
      setFacialExpression("default");
    }
  }, [isSpeaking, isListening]);

  // Play the selected animation
  useEffect(() => {
    const action = actions[animation];
    if (action) {
      action
        .reset()
        .fadeIn(mixer.stats.actions.inUse === 0 ? 0 : 0.5)
        .play();
      return () => {
        if (actions[animation]) {
          actions[animation].fadeOut(0.5);
        }
      };
    }
  }, [animation]);

  // Smooth morph target interpolation
  const lerpMorphTarget = (target, value, speed = 0.1) => {
    scene.traverse((child) => {
      if (child.isSkinnedMesh && child.morphTargetDictionary) {
        const index = child.morphTargetDictionary[target];
        if (index === undefined || child.morphTargetInfluences[index] === undefined) {
          return;
        }
        child.morphTargetInfluences[index] = THREE.MathUtils.lerp(
          child.morphTargetInfluences[index],
          value,
          speed
        );
      }
    });
  };

  // Per-frame update: facial expressions + audio-driven lip-sync
  useFrame(() => {
    // Apply facial expressions (skip blink targets — handled separately)
    morphTargets.forEach((key) => {
      if (key === "eyeBlinkLeft" || key === "eyeBlinkRight") return;
      const mapping = facialExpressions[facialExpression];
      if (mapping && mapping[key]) {
        lerpMorphTarget(key, mapping[key], 0.1);
      } else {
        lerpMorphTarget(key, 0, 0.1);
      }
    });

    // Blinking
    lerpMorphTarget("eyeBlinkLeft", blink ? 1 : 0, 0.5);
    lerpMorphTarget("eyeBlinkRight", blink ? 1 : 0, 0.5);

    // Audio-driven mouth movement (real-time from analyser)
    let mouthOpenValue = 0;
    if (isSpeaking && analyserRef?.current && dataArrayRef.current) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      const d = dataArrayRef.current;
      // Compute energy from speech frequency bands
      const lo = (d[1] + d[2] + d[3] + d[4] + d[5]) / 5;
      const mid = (d[6] + d[7] + d[8] + d[9] + d[10] + d[11] + d[12] + d[13]) / 8;
      mouthOpenValue = Math.min((lo * 0.5 + mid * 0.5) / 120, 1);
    }

    // Drive multiple viseme morph targets for natural look
    lerpMorphTarget("jawOpen", mouthOpenValue * 0.7, 0.25);
    lerpMorphTarget("mouthOpen", mouthOpenValue * 0.6, 0.25);
    lerpMorphTarget("viseme_aa", mouthOpenValue * 0.5, 0.2);
    lerpMorphTarget("viseme_O", mouthOpenValue * 0.3, 0.2);
    lerpMorphTarget("viseme_E", mouthOpenValue * 0.15, 0.2);

    // Subtle mouth movement when not speaking (idle breathing)
    if (!isSpeaking) {
      lerpMorphTarget("jawOpen", 0, 0.1);
      lerpMorphTarget("mouthOpen", 0, 0.1);
      lerpMorphTarget("viseme_aa", 0, 0.1);
      lerpMorphTarget("viseme_O", 0, 0.1);
      lerpMorphTarget("viseme_E", 0, 0.1);
    }
  });

  // Random blinking
  useEffect(() => {
    let blinkTimeout;
    const nextBlink = () => {
      blinkTimeout = setTimeout(() => {
        setBlink(true);
        setTimeout(() => {
          setBlink(false);
          nextBlink();
        }, 200);
      }, THREE.MathUtils.randInt(1000, 5000));
    };
    nextBlink();
    return () => clearTimeout(blinkTimeout);
  }, []);

  return (
    <group {...props} dispose={null} ref={group} position={[0, -0.5, 0]}>
      <primitive object={nodes.Hips} />
      <skinnedMesh
        name="EyeLeft"
        geometry={nodes.EyeLeft.geometry}
        material={materials.Wolf3D_Eye}
        skeleton={nodes.EyeLeft.skeleton}
        morphTargetDictionary={nodes.EyeLeft.morphTargetDictionary}
        morphTargetInfluences={nodes.EyeLeft.morphTargetInfluences}
      />
      <skinnedMesh
        name="EyeRight"
        geometry={nodes.EyeRight.geometry}
        material={materials.Wolf3D_Eye}
        skeleton={nodes.EyeRight.skeleton}
        morphTargetDictionary={nodes.EyeRight.morphTargetDictionary}
        morphTargetInfluences={nodes.EyeRight.morphTargetInfluences}
      />
      <skinnedMesh
        name="Wolf3D_Head"
        geometry={nodes.Wolf3D_Head.geometry}
        material={materials.Wolf3D_Skin}
        skeleton={nodes.Wolf3D_Head.skeleton}
        morphTargetDictionary={nodes.Wolf3D_Head.morphTargetDictionary}
        morphTargetInfluences={nodes.Wolf3D_Head.morphTargetInfluences}
      />
      <skinnedMesh
        name="Wolf3D_Teeth"
        geometry={nodes.Wolf3D_Teeth.geometry}
        material={materials.Wolf3D_Teeth}
        skeleton={nodes.Wolf3D_Teeth.skeleton}
        morphTargetDictionary={nodes.Wolf3D_Teeth.morphTargetDictionary}
        morphTargetInfluences={nodes.Wolf3D_Teeth.morphTargetInfluences}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Glasses.geometry}
        material={materials.Wolf3D_Glasses}
        skeleton={nodes.Wolf3D_Glasses.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Headwear.geometry}
        material={materials.Wolf3D_Headwear}
        skeleton={nodes.Wolf3D_Headwear.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Body.geometry}
        material={materials.Wolf3D_Body}
        skeleton={nodes.Wolf3D_Body.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Outfit_Bottom.geometry}
        material={materials.Wolf3D_Outfit_Bottom}
        skeleton={nodes.Wolf3D_Outfit_Bottom.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Outfit_Footwear.geometry}
        material={materials.Wolf3D_Outfit_Footwear}
        skeleton={nodes.Wolf3D_Outfit_Footwear.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Outfit_Top.geometry}
        material={materials.Wolf3D_Outfit_Top}
        skeleton={nodes.Wolf3D_Outfit_Top.skeleton}
      />
    </group>
  );
}

useGLTF.preload("/models/avatar.glb");
useGLTF.preload("/models/animations.glb");
