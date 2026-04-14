"use client";

import { useState, useEffect } from "react";
import { Joyride, STATUS, type Step, type EventData } from "react-joyride";

const STORAGE_KEY = "onboarding:paper:done";

const steps: Step[] = [
  {
    target: "[data-onboarding='tabs']",
    title: "문서 탭",
    content:
      "PDF 원문, AI 분석 결과, 배경지식 문서를 탭으로 전환할 수 있습니다.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-onboarding='text-select']",
    title: "텍스트 선택",
    content:
      "텍스트를 드래그하면 하이라이트하거나 AI에게 질문할 수 있습니다.",
    placement: "right",
    skipBeacon: true,
  },
  {
    target: "[data-onboarding='text-select']",
    title: "인용 참조",
    content:
      "논문 속 [N] 번호를 클릭하면 해당 참고문헌 정보를 바로 확인할 수 있습니다.",
    placement: "right",
    skipBeacon: true,
  },
  {
    target: "[data-onboarding='presets']",
    title: "빠른 질문",
    content:
      "자주 묻는 질문이나 배경지식 토픽을 버튼으로 바로 질문할 수 있습니다.",
    placement: "left",
    skipBeacon: true,
  },
  {
    target: "[data-onboarding='chat-input']",
    title: "AI 채팅",
    content:
      "논문에 대해 자유롭게 질문하세요. AI가 분석 문서와 배경지식을 참고하여 답변합니다.",
    placement: "left",
    skipBeacon: true,
  },
  {
    target: "[data-onboarding='export']",
    title: "분석 보강",
    content:
      "대화가 끝나면 채팅 내용을 바탕으로 분석 문서를 자동으로 보강할 수 있습니다.",
    placement: "bottom",
    skipBeacon: true,
  },
];

export default function PaperOnboarding() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const timer = setTimeout(() => setRun(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleEvent = (data: EventData) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem(STORAGE_KEY, "true");
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      onEvent={handleEvent}
      options={{
        primaryColor: "#2563eb",
        showProgress: true,
        buttons: ["back", "primary", "skip"],
      }}
      locale={{
        back: "이전",
        close: "닫기",
        last: "시작하기",
        next: "다음",
        skip: "건너뛰기",
      }}
    />
  );
}
