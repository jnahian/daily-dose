import React from "react";
import { Composition } from "remotion";
import { MainVideo } from "./compositions/MainVideo";
import { Reel } from "./compositions/Reel";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="MainVideo"
      component={MainVideo}
      durationInFrames={1620}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="Reel"
      component={Reel}
      durationInFrames={1620}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);
