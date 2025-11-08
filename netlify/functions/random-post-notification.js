exports.handler = async function (event, context) {
    try {
        // 1. Fetch one random published post with featured image embedded
        const wpUrl =
            "https://ccodelearner.com/wp-json/wp/v2/posts?per_page=1&orderby=rand&status=publish&_embed";
        const wpRes = await fetch(wpUrl);
        if (!wpRes.ok) throw new Error("WordPress API error");

        const posts = await wpRes.json();
        if (!posts || posts.length === 0) {
            return { statusCode: 200, body: "No published posts found" };
        }

        const post = posts[0];
        const title = (post.title.rendered || "Check this out!").trim();
        let excerpt = (post.excerpt?.rendered || "")
            .replace(/<[^>]+>/g, "")   // strip HTML
            .replace(/\[[^\]]+\]/g, "") // strip shortcodes
            .trim();
        if (excerpt.length > 150) excerpt = excerpt.substring(0, 147) + "...";

        const link = post.link;

        // Featured image (full size → fallback to large if needed)
        let imageUrl = null;
        const media = post._embedded?.["wp:featuredmedia"]?.[0];
        if (media?.source_url) imageUrl = media.source_url;
        else if (media?.media_details?.sizes?.large?.source_url)
            imageUrl = media.media_details.sizes.large.source_url;

        // 2. Build OneSignal payload
        const notification = {
            app_id: process.env.ONESIGNAL_APP_ID,
            included_segments: ["Subscribed Users"], // sends to ALL subscribers
            headings: { en: "Random Post Pick ✨" },
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

        console.log(`Success! Sent to ${result.recipients} subscribers`);
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, recipients: result.recipients }),
        };
    } catch (err) {
        console.error("Error:", err);
        return { statusCode: 500, body: err.message };
    }
};