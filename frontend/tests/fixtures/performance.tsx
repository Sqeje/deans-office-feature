// Development-only test entry. Not included in Vite's production entry graph.
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Page } from "../../src/modules/academic-performance/Page";
import { loadDemoPerformance } from "../../src/modules/academic-performance/demo";
import type { PerformanceLoader } from "../../src/modules/academic-performance/model";
import "../../src/style.css";
import { PerformanceShell } from "../../src/modules/academic-performance/PerformanceShell";
import { modulePages } from "../../src/modules/sections";
const mode = new URLSearchParams(location.search).get("mode");
let calls = 0;
const loader: PerformanceLoader = async (id, signal) => {
  const call = ++calls;
  if (mode === "retry" && call === 1) throw new Error("Simulated test error");
  if (mode === "slow" || (mode === "race" && call === 1))
    await new Promise((resolve) => setTimeout(resolve, 1500));
  if (mode === "no-grades")
    return {
      semesterId: id,
      disciplines: [
        {
          id: "pending",
          name: "Предмет без оценок",
          assessment: "exam",
          grades: [],
          final: null,
          status: "pending",
          debt: null,
          examDate: null,
        },
      ],
    };
  return loadDemoPerformance(id, signal);
};
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <PerformanceShell
      pages={modulePages.filter((p) => p.area === "student")}
      name="Александр"
      onLogout={() => location.assign("/login")}
    >
      <Page loader={loader} />
    </PerformanceShell>
  </BrowserRouter>,
);
