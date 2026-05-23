import { useEffect, useRef } from "react";
import { Factory, EasyScore, System } from "vexflow";

export default function SheetMusic() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    

    const factory = new Factory({
      renderer: {
        elementId: container as unknown as string,
        width: 500,
        height: 200,
      },
    })

    const score = factory.EasyScore()
    const system = factory.System()

    system
      .addStave({
        voices: [
          score.voice(score.notes("C#5/q, B4, A4, G#4", { stem: "up" })),
          score.voice(score.notes("C#4/h, C#4", { stem: "down" })),
        ],
      })
      .addClef("treble")
      .addTimeSignature("4/4")

    factory.draw()

    return () => {
      if (container) container.innerHTML = "";
    }
  }, []);

  return <div ref={containerRef} />;
}
