# 주원 적금 통합 & 자산 가계부 대시보드

구글 스프레드시트 게시 URL(TSV) 및 Apps Script 웹앱과 실시간 연동되는 주원 적금 통합 자산 가계부 대시보드입니다.

---

## 📁 프로젝트 파일 구성

- **`index.html`** : 대시보드 메인 레이아웃 (KPI 카드가, 적금 진행 현황, 누적 장부, 구글 연동 설정)
- **`style.css`** : 프리미엄 스타일링, 반응형 UI
- **`app.js`** : 구글 TSV/JSON 실시간 자동 동기화 엔진 및 엑셀 익스포트
- **`README.md`** : 도메인 자동화 및 무료 호스팅 연결 안내 가이드

---

## 🔗 구글 시트 웹앱 배포 시 권한 오류 해결 안내 (필수)

구글 Apps Script 웹앱 URL(`https://script.google.com/macros/s/.../exec`) 연결 시 **구글 로그인 창이 뜨거나 데이터를 못 가져오는 현상**이 발생할 경우:

1. Apps Script 편집기 오른쪽 상단 **[배포 (Deploy)] > [배포 관리 (Manage deployments)]** 또는 **[새 배포]** 클릭.
2. **액세스 권한 있는 사용자 (Who has access)** 항목을 **`나만 (Only myself)`**에서 **`모든 사용자 (Anyone)`**로 변경합니다.
3. 배포를 새로 생성하거나 저장하신 후 생성된 URL을 대시보드 **[구글 시트 백업/연동 설정]** 탭에 입력해 주세요!

---

## 🌐 무료 호스팅 & 도메인 연결 방법 (Vercel / Cloudflare / GitHub Pages)

- **Vercel**: GitHub 저장소 연동 후 1-Click 배포 및 커스텀 도메인(`yourdomain.com`) CNAME 등록
- **Cloudflare Pages**: 무료 무제한 트래픽 및 1분 만에 SSL 적용 커스텀 도메인 연동 지원
