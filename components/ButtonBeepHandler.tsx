"use client";

import { useEffect } from "react";

import { beepForClickTarget, isButtonLikeTarget, preloadButtonBeeps } from "@/lib/button-beep";

export function ButtonBeepHandler() {
  useEffect(() => {
    preloadButtonBeeps();

    const onClickCapture = (event: MouseEvent) => {
      if (!isButtonLikeTarget(event.target)) {
        return;
      }
      beepForClickTarget(event.target)();
    };

    document.addEventListener("click", onClickCapture, true);

    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  return null;
}
