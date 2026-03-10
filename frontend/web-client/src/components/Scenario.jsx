import { CameraControls, Environment } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { Avatar3D } from "./Avatar3D";

/**
 * Scenario — Three.js scene wrapper with camera, lighting, and the 3D avatar.
 *
 * Props passed through to Avatar3D:
 *   isSpeaking, isListening, analyserRef
 */
export function Scenario({ isSpeaking, isListening, analyserRef }) {
  const cameraControls = useRef();

  useEffect(() => {
    // Position camera to show upper body/face of the avatar
    cameraControls.current.setLookAt(0, 2.2, 5, 0, 1.0, 0, true);
  }, []);

  return (
    <>
      <CameraControls ref={cameraControls} />
      <Environment preset="sunset" />
      <Avatar3D
        isSpeaking={isSpeaking}
        isListening={isListening}
        analyserRef={analyserRef}
      />
    </>
  );
}
