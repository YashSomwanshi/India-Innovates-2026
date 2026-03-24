import { CameraControls, Environment } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { Avatar3DRealtime } from "./Avatar3DRealtime";

/**
 * Scenario — Three.js scene wrapper with camera, lighting, and the 3D avatar.
 *
 * Props passed through to Avatar3DRealtime:
 *   isSpeaking, isListening, analyserRef, currentText, audioRef
 */
export function Scenario({ isSpeaking, isListening, analyserRef, currentText, audioRef, pipelineStage }) {
  const cameraControls = useRef();

  useEffect(() => {
    // Position camera to show upper body/face of the avatar
    cameraControls.current.setLookAt(0, 2.2, 5, 0, 1.0, 0, true);
  }, []);

  return (
    <>
      <CameraControls ref={cameraControls} />
      <Environment preset="sunset" />
      {/* Ambient fill light for better face visibility */}
      <ambientLight intensity={0.4} />
      {/* Key light from front-right */}
      <directionalLight position={[2, 3, 4]} intensity={0.6} />
      <Avatar3DRealtime
        isSpeaking={isSpeaking}
        isListening={isListening}
        analyserRef={analyserRef}
        currentText={currentText}
        audioRef={audioRef}
        pipelineStage={pipelineStage}
      />
    </>
  );
}
