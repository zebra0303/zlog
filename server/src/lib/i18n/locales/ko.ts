import type { TranslationKeys } from "./en.js";

export const ko: Record<TranslationKeys, string> = {
  slack_new_comment: "💬 새 댓글 알림",
  slack_new_reply: "↩️ 새 답글 알림",
  slack_post: "📝 글: {title}",
  slack_author: "👤 작성자: {authorName}",
  slack_content: "💬 내용: {content}",
  slack_new_federation_subscriber: "🤝 새 Federation 구독자 알림",
  slack_federation_reactivated: "🤝 Federation 구독 재활성화 알림",
  slack_category: "📂 카테고리: {categoryName}",
  slack_subscriber_url: "🌐 구독자 URL: {url}",
};
