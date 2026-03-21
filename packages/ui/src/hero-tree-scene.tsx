"use client";

import { useEffect, useState } from "react";

const leaves = [
  { id: "leaf-1", left: "30%", top: "18%", delay: "0s", duration: "10.6s", drift: "70px", scale: "1" },
  { id: "leaf-2", left: "38%", top: "12%", delay: "1.2s", duration: "9.2s", drift: "92px", scale: "0.88" },
  { id: "leaf-3", left: "48%", top: "10%", delay: "2.8s", duration: "11.2s", drift: "80px", scale: "1.08" },
  { id: "leaf-4", left: "56%", top: "13%", delay: "4.5s", duration: "10.2s", drift: "84px", scale: "0.94" },
  { id: "leaf-5", left: "63%", top: "18%", delay: "3.4s", duration: "12s", drift: "95px", scale: "1.02" },
  { id: "leaf-6", left: "69%", top: "24%", delay: "5.1s", duration: "9.6s", drift: "74px", scale: "0.9" },
  { id: "leaf-7", left: "44%", top: "24%", delay: "6.2s", duration: "10.8s", drift: "76px", scale: "0.86" },
  { id: "leaf-8", left: "35%", top: "28%", delay: "7s", duration: "11.4s", drift: "88px", scale: "0.96" },
  { id: "leaf-9", left: "58%", top: "28%", delay: "8.1s", duration: "9.8s", drift: "82px", scale: "1.06" },
  { id: "leaf-10", left: "74%", top: "31%", delay: "2.1s", duration: "12.2s", drift: "100px", scale: "0.82" },
  { id: "leaf-11", left: "26%", top: "26%", delay: "4.1s", duration: "10.4s", drift: "72px", scale: "0.9" },
  { id: "leaf-12", left: "52%", top: "20%", delay: "5.8s", duration: "11.8s", drift: "108px", scale: "0.92" }
];

const sparks = [
  { id: "spark-1", left: "18%", top: "14%", delay: "0s", duration: "7s" },
  { id: "spark-2", left: "76%", top: "16%", delay: "1.4s", duration: "8.4s" },
  { id: "spark-3", left: "22%", top: "48%", delay: "2.4s", duration: "7.6s" },
  { id: "spark-4", left: "68%", top: "44%", delay: "3.1s", duration: "8.2s" },
  { id: "spark-5", left: "34%", top: "28%", delay: "4.4s", duration: "6.9s" },
  { id: "spark-6", left: "58%", top: "58%", delay: "5.3s", duration: "7.8s" }
];

export function HeroTreeScene() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [engage, setEngage] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setEngage(Math.min(window.scrollY / 500, 1));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="glow-tree-scene"
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        setMouse({ x, y });
      }}
      onPointerLeave={() => setMouse({ x: 0, y: 0 })}
      style={
        {
          "--tree-mouse-x": `${mouse.x}`,
          "--tree-mouse-y": `${mouse.y}`,
          "--tree-engage": `${engage}`
        } as React.CSSProperties
      }
    >
      <div className="glow-tree" aria-hidden="true">
        <span className="tree-aura" />
        <span className="tree-trunk" />
        <span className="tree-trunk-core" />
        <span className="tree-energy tree-energy-trunk" />
        <span className="tree-energy tree-energy-canopy" />
        <span className="tree-root root-left" />
        <span className="tree-root root-right" />
        <span className="tree-branch branch-low-left" />
        <span className="tree-branch branch-low-right" />
        <span className="tree-branch branch-mid-left" />
        <span className="tree-branch branch-mid-right" />
        <span className="tree-branch branch-high-left" />
        <span className="tree-branch branch-high-right" />
        <span className="tree-canopy canopy-core" />
        <span className="tree-canopy canopy-left" />
        <span className="tree-canopy canopy-center" />
        <span className="tree-canopy canopy-right" />
        <span className="tree-canopy canopy-top" />
        <span className="tree-canopy canopy-lower" />
        {leaves.map((leaf) => (
          <span
            key={leaf.id}
            className="tree-leaf"
            style={
              {
                "--leaf-left": leaf.left,
                "--leaf-top": leaf.top,
                "--leaf-delay": leaf.delay,
                "--leaf-duration": leaf.duration,
                "--leaf-drift": leaf.drift,
                "--leaf-scale": leaf.scale
              } as React.CSSProperties
            }
          />
        ))}
        {sparks.map((spark) => (
          <span
            key={spark.id}
            className="tree-spark"
            style={
              {
                "--spark-left": spark.left,
                "--spark-top": spark.top,
                "--spark-delay": spark.delay,
                "--spark-duration": spark.duration
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
