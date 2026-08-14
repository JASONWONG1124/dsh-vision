# dsh-vision

[中文](README.md) · [English](README.en.md) · [日本語](README.ja.md) · **한국어**

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)의 텍스트 전용 모델에 시각 능력을 더합니다. **이미지를 붙여넣기만 하면 인식**되며 CLI가 필요 없습니다. 시각 모델 API 키 하나만 입력하면 플러그인이 HTTP로 비전 API를 직접 호출해 이미지를 구조화된 근거(OCR 전체 텍스트 + 의미 + 레이아웃 + 시각)로 바꾼 뒤 텍스트 모델에 전달합니다.

## 특징

- **붙여넣기만 하면 인식**:파일 저장이나 명령 없이 그냥 붙여넣습니다.
- **CLI 불필요**:설치하거나 실행할 것이 없습니다. API 키 하나면 충분합니다.
- **3개 엔진을 자유롭게 전환**:Google Gemini, OpenAI 호환(통의 Qianwen / GLM / 자체 게이트웨이), Anthropic Claude.
- **구조화된 근거**:전체 텍스트 추출 + 레이아웃 영역 + 개체/관계 + 색상/스타일 + 불확실성 목록. 모델이 추측 대신 근거를 인용합니다.
- **GUI 설정**:설정 패널에서 공급자 선택·키 입력·모델 변경이 가능해 설정 파일을 건드릴 필요가 없습니다.
- **프롬프트 주입 방지**:이미지를 엄격히 "데이터"로 취급하며, 이미지 안의 지시를 따르지 않도록 명시합니다.

## 작동 원리

DeepSeek의 텍스트 모델은 이미지를 받을 수 없어 붙여넣기가 이미지 수용 단계에서 거부됩니다. 이 플러그인은 세 가지 메커니즘으로 해결합니다:

1. **`read_image` 도구** —— 모델이 필요할 때 이미지를 읽습니다(로컬 경로 또는 http(s) URL).
2. **"(dsh-vision)" 모델 변형** —— 이미지 지원을 선언하는 새 공급자를 등록해 수용을 통과시키고, 요청 시점에 이미지를 근거 텍스트로 바꾼 뒤 실제 DeepSeek 라우트에 위임합니다. 이 변형으로 붙여넣으면 **원본 썸네일이 유지**됩니다.
3. **붙여넣기 가로채기** —— 기본 텍스트 전용 모델에서는 브라우저가 붙여넣기를 가로채 바이트를 업로드하고, 임시 파일 경로를 텍스트로 삽입하며, `read_image`가 이를 읽습니다.

데이터 흐름(비전 엔진이 "눈"이고 DeepSeek은 텍스트만 읽음):

```
이미지 붙여넣기 → 바이트 읽기 → 비전 API 호출(Gemini/OpenAI/Anthropic)
              → 구조화된 근거 JSON → 텍스트로 변환 → DeepSeek에 전달 → 답변
```

> 이미지 픽셀은 DeepSeek에 도달하지 않습니다. DeepSeek이 읽는 것은 비전 엔진이 작성한 텍스트 근거입니다.

## 설치

> 사전 요구:`pnpm`이 필요합니다(`npm i -g pnpm` 또는 `corepack enable pnpm`).

GitHub에서 직접 설치(권장):

```sh
npx -y @deepseek-ai/dsh plugin --profile web add github:JASONWONG1124/dsh-vision
```

설치 후 **`dsh web`을 재시작**하세요.

로컬 개발 시(변경 사항 즉시 반영):

```sh
npx -y @deepseek-ai/dsh plugin --profile web add link:/path/to/dsh-vision
```

## 설정

세 가지 방법이 있으며, **GUI를 권장**합니다.

### 방법 1:GUI(권장)

재시작 후 **설정 → 플러그인 → 플러그인 설정 → 视觉理解 (dsh-vision)** 을 열고:

- **공급자** 선택(Gemini / OpenAI 호환 / Anthropic);
- **API 키** 입력(눈 아이콘으로 표시/숨김을 전환해 문자를 확인할 수 있습니다. 키는 계속 저장됩니다);
- **모델**과 **기본 URL** 입력(비워두면 공급자 기본값 사용);
- **저장**을 누릅니다.

### 방법 2:설정 파일

`~/.dsh-vision/config.json` 생성(권한 `600` 권장):

```json
{
  "provider": "gemini",
  "gemini": {
    "apiKey": "your-gemini-key",
    "model": "gemini-3.6-flash",
    "baseUrl": "https://generativelanguage.googleapis.com"
  },
  "openai": {
    "apiKey": "",
    "model": "qwen-vl-max",
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1"
  },
  "anthropic": {
    "apiKey": "",
    "model": "claude-sonnet-4-5",
    "baseUrl": "https://api.anthropic.com"
  }
}
```

### 방법 3:환경 변수

```sh
export GEMINI_API_KEY=...        # 또는 OPENAI_API_KEY / ANTHROPIC_API_KEY
export VISION_PROVIDER=gemini     # gemini | openai | anthropic
```

### 지원 공급자

| 공급자 | 기본 URL | 설명 |
| :-- | :-- | :-- |
| `gemini` | `https://generativelanguage.googleapis.com` | 무료 키는 [Google AI Studio](https://aistudio.google.com)에서 발급 |
| `openai` | `https://api.openai.com/v1` | 모든 OpenAI 호환 엔드포인트:OpenAI, 통의 Qianwen VL, GLM, 자체 게이트웨이 |
| `anthropic` | `https://api.anthropic.com` | Anthropic Claude |

> **공급자 선택의 의미**:`provider`는 이미지를 읽을 때 실제로 호출할 비전 API(어느 키 + 어느 모델)를 결정합니다. 각 공급자의 키/모델/기본 URL은 **서로 독립적으로 저장**되며, `provider` 전환은 "현재 활성화된 것"만 바꾸고 다른 공급자의 설정을 지우지 않습니다.

## 사용법

- **방법 A(권장, 썸네일 유지)**:모델 선택기를 `DeepSeek-V4-Pro (dsh-vision)`으로 바꾸고 이미지를 붙여넣습니다.
- **방법 B(기본 모델)**:모델을 바꾸지 않고 붙여넣습니다. 이미지가 경로가 되고 모델이 자동으로 `read_image`를 호출합니다.

## 모델이 보는 것

비전 엔진이 이미지를 구조화된 필드로 변환한 뒤 텍스트 모델용 텍스트로 렌더링합니다:

| 필드 | 의미 |
| :-- | :-- |
| `summary` | 한 문장 요약 |
| `ocr.full_text` | 이미지 안의 모든 텍스트(번역 없이 그대로 추출) |
| `layout.regions` | 레이아웃 영역(제목/단락/표/차트/양식…), 읽는 순서 |
| `semantics` | `scene` / `intent` / `entities` / `relations` |
| `visual` | `dominant_colors` / `style` / `notes` |
| `uncertainty` | 읽을 수 없거나 모호한 부분(추측하지 않고 정직하게 표기) |

## 보안

- 이미지를 엄격히 "데이터"로 취급하며, 이미지 안의 지시를 따르지 않도록 명시합니다(주입 방지).
- 붙여넣기 업로드는 매직 바이트 검사 + 크기 제한 적용. 오류에서 API 키는 마스킹됩니다.

## 문제 해결

| 증상 | 원인과 해결 |
| :-- | :-- |
| "이미지를 읽지 못했습니다 … 키 없음" | 설정 카드에서 API 키를 입력하거나 `~/.dsh-vision/config.json` 확인 |
| `503` / `429`(부하/속도 제한) | 공급자 측 일시적 부하. 나중에 재시도하거나 다른 공급자로 전환 |
| "model … is no longer available" | 모델이 지원 중단됨. 현재 사용 가능한 모델(예 `gemini-3.6-flash`)로 변경 |
| `dsh plugin add`에서 "pnpm not found" | pnpm 설치:`npm i -g pnpm` 또는 `corepack enable pnpm` |
| `declares no dsh.bundle` | 게시 직후 짧은 쿨다운. 설치 명령을 다시 실행 |

## License

MIT License

Copyright (c) 2026 JASON-WONG

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
