# Deming Funnel Experiment Simulator

This application is an interactive digital implementation of **W. Edwards Deming’s Funnel Experiment**. It serves as a powerful demonstration of systems thinking and the hazards of "tampering"—the act of adjusting a stable process in response to common-cause variation, which invariably increases the variance of the system.

**Live Demo:** [View the Simulation](https://derailleuragile.github.io/funnel-experiment-sim/funnel-experiment.html)

---

## 🧐 What is the Funnel Experiment?

In the original thought experiment, a funnel is suspended over a target on a table. A marble is dropped through the funnel, and its landing position is marked. The goal is to hit the target, but inherent "noise" (vibration, marble shape, funnel, table surface) causes the marble to land in a distribution pattern around the target.

In response, the funnel position is adjusted to compensate for the marble's drift around the target, in the hope this will cause more drops to land on target. The experiment demonstrates how when we attempt to control a process by reacting to it that we can end up making things worse.

---

## 🛠 Technical Implementation

The simulator is built using a modern web stack designed for high-performance rendering and statistical visualization:

### The Simulation Engine

* **Canvas Rendering:** The marble drops are rendered on a high-definition 4000x2400 pixel HTML5 Canvas.
* **Pan & Zoom:** Uses `Panzoom.js` to allow users to navigate the large coordinate space, which is essential for observing the "Random Walk" behavior in Rule 4.
* **Data Visualization:** Real-time histograms and run charts are generated using `Plotly.js` to track the distribution and distance of drops from the target.

### Marble Physics & Noise Models

To simulate real-world variability, the engine uses several mathematical models for noise:

* **Gaussian:** Standard random variation using a Box-Muller transform.
* **Truncated + Drift:** Simulates a system that slowly loses its "true" center over time, mimicking tool wear or environmental shifts.
* **Bounce then Roll:** A custom multi-step algorithm that mimics physical momentum, where a marble hits a surface (Initial SD) and then rolls in a random direction (Secondary SD).

---

## 📏 The Four Rules of Tampering

The simulator allows you to toggle between four distinct strategies for positioning the funnel:

| Rule | Logic | Action Taken | Result |
| --- | --- | --- | --- |
| **Rule 1** | **No Adjustments** | The funnel remains fixed over the target for every drop. | **Stable System.** Represents the minimum variance the current system can achieve. |
| **Rule 2** | **Compensate from Last Position** | If the marble lands  units from the target, move the funnel  units from its *current* position. | **Increased Variance.** The output oscillates, effectively doubling the variance of Rule 1. |
| **Rule 3** | **Compensate from Target** | Move the funnel to a position relative to the target: . | **Divergence.** The system swings back and forth with increasing magnitude until it goes out of control. |
| **Rule 4** | **Follow Last Drop** | The funnel is moved directly over the spot where the last marble landed. | **Random Walk.** The funnel eventually wanders off in a random direction with no memory of the original target. |

---

## 🚀 Getting Started

1. **Select a Rule:** Start with Rule 1 to establish a baseline.
2. **Adjust Sigma ():** Use the slider to increase or decrease the inherent system noise.
3. **Choose a Noise Model:** Compare how "Gaussian" noise differs from "Bounce then Roll".
4. **Analyze:** Use the **Export** button to download the raw distance data as a CSV for deeper statistical analysis.

---

## 📜 Credits

* **Coded by:** Christopher R. Chapman.
* **Concept:** Inspired by the teachings of W. Edwards Deming in The New Economics (1993)
* **Learn More:** [The Lessons of the Funnel](https://digestibledeming.substack.com/p/lessons-of-the-funnel).
