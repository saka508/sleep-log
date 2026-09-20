import AnalysisDetailScreen from "@/components/analysis-detail";

export function generateStaticParams() {
  return [
    { category: "sleep" },
    { category: "condition" },
    { category: "headache" },
    { category: "environment" },
  ];
}

export default AnalysisDetailScreen;
