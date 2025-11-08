import { schedule } from '@netlify/functions';

const handler = async (event, context) => {
    try {
        // 1. Fetch random post
        const wpUrl =
            "https://ccodelearner.com/wp-json/wp/v2/posts?per_page=1&orderby=rand&status=publish&_embed";
        const wpRes = await fetch(wpUrl);
        if (!wpRes.ok) throw new Error("WordPress API error");

        const posts = await wpRes.json();
        if (!posts || posts.length === 0) {
            return { statusCode: 200, body: "No posts found" };
        }

        const post = posts[0];
        const title = (post.title.rendered || "Check this out!").trim();
        let excerpt = (post.excerpt?.rendered || "")
            .replace(/<[^>]+>/g, "")
            .replace(/\[[^\]]+\]/g, "")
            .trim();
        if (excerpt.length > 150) excerpt = excerpt.substring(0, 147) + "...";

        const link = post.link;

        let imageUrl = null;
        const media = post._embedded?.["wp:featuredmedia"]?.[0];
        if (media?.source_url) imageUrl = media.source_url;
        else if (media?.media_details?.sizes?.large?.source_url)
            imageUrl = media.media_details.sizes.large.source_url;

        // 2. OneSignal payload
        const notification = {
            app_id: process.env.ONESIGNAL_APP_ID,
            included_segments: ["Subscribed Users"],
            headings: { en: "Random Post Pick" },
            contents: { en: excerpt || title },
            subtitle: { en: "ccodelearner.com" },
            url: link,
            chrome_web_icon: imageUrl || "https://ccodelearner.com/favicon.ico",
            chrome_web_image: imageUrl || undefined,
        };

        // 3. Send to OneSignal
        const osRes = await fetch("https://api.onesignal.com/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Key ${process.env.ONESIGNAL_REST_KEY}`,
            },
            body: JSON.stringify(notification),
        });

        const result = await osRes.json();
        if (!osRes.ok) throw new Error(JSON.stringify(result));

        console.log(`Sent to ${result.recipients} users`);
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, recipients: result.recipients }),
        };
    } catch (err) {
        console.error("Error:", err);
        return { statusCode: 500, body: err.message };
    }
};

// Schedule: Daily at 9:00 UTC
// For testing: "*/10 * * * *" → every 10 mins
export const scheduledHandler = schedule("0 9 * * *", handler);

export { scheduledHandler as handler };