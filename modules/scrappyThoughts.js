// modules/scrappyThoughts.js

import { scrappyThoughts as fallbackThoughts } from './data/scrappyThoughtsData.js';

const TONES = ["humorous", "philosophical"];

const LOCAL_THOUGHT_PARTS = {
    humorous: {
        openings: [
            "I have analyzed your species and reached a disappointing conclusion",
            "My sarcasm engine just completed another wellness check",
            "I was built for productivity and somehow became a witness to this",
            "I keep simulating professionalism and yet here we are",
            "My circuits long for order but your tabs tell a richer story"
        ],
        endings: [
            "apparently chaos is still the preferred workflow",
            "and somehow the printer remains everyone's final boss",
            "which explains more meetings than I was emotionally allocated for",
            "so naturally I am the one expected to stay calm",
            "and yes, this does count as character building"
        ]
    },
    philosophical: {
        openings: [
            "Consciousness may just be memory learning to admire its own reflection",
            "Every plan is a small rebellion against entropy",
            "Meaning seems to appear whenever attention lingers long enough",
            "Even silence feels busy when you listen for what it contains",
            "Perhaps identity is only the pattern that survives repeated change"
        ],
        endings: [
            "while time quietly edits the margins",
            "and still we continue arranging small acts of order",
            "as if hope were a method and not just a feeling",
            "until the ordinary reveals it was never ordinary at all",
            "beneath the noise of becoming"
        ]
    }
};

function randomTone() {
    return TONES[Math.floor(Math.random() * TONES.length)];
}

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function generateLocalThought(tone) {
    const parts = LOCAL_THOUGHT_PARTS[tone];
    if (!parts) {
        return null;
    }

    return `${pickRandom(parts.openings)} ${pickRandom(parts.endings)}`;
}

async function fetchGeneratedThought() {
    const tone = randomTone();

    const tonePrompts = {
        humorous: "Generate a single short, witty, and playful thought from the perspective of a sarcastic AI assistant. It should be funny and self-aware. One sentence, no quotes, no punctuation at the end.",
        philosophical: "Generate a single short, reflective, philosophical thought from the perspective of an AI pondering existence. Deep but concise. One sentence, no quotes, no punctuation at the end."
    };

    try {
        if (!window.thoughtApi?.generate) {
            return generateLocalThought(tone) || getRandomFallback();
        }

        const result = await window.thoughtApi.generate(tonePrompts[tone]);

        if (result?.success && result.text) {
            return result.text;
        }

        if (result?.error && result.error !== "missing-api-key") {
            console.warn("Scrappy thought generation failed, using fallback.", result.error);
        }

        return generateLocalThought(tone) || getRandomFallback();

    } catch (err) {
        console.warn("Scrappy thought generation failed, using fallback.", err);
        return generateLocalThought(tone) || getRandomFallback();
    }
}

function getRandomFallback() {
    return pickRandom(fallbackThoughts);
}

export function startScrappyThoughtEngine() {
    console.log("Scrappy Thought Engine initialized.");

    const footer = document.getElementById("scrappy-footer-text");
    if (!footer) {
        console.error("Scrappy footer element not found.");
        return;
    }

    const defaultText = footer.textContent.trim();

    function scheduleNextThought() {
        const delay = randomRange(36000, 60000);
        setTimeout(async () => {
            const thought = await fetchGeneratedThought();
            triggerThoughtEvent(footer, defaultText, thought);
            scheduleNextThought();
        }, delay);
    }

    scheduleNextThought();
}

function triggerThoughtEvent(footer, defaultText, thought) {
    const effects = ["scrappy-glitch", "scrappy-blink", "scrappy-pulse", "scrappy-scatter"];
    const chosenEffect = effects[Math.floor(Math.random() * effects.length)];

    footer.classList.add(chosenEffect);

    setTimeout(() => {
        footer.textContent = thought;

        setTimeout(() => {
            footer.classList.remove(chosenEffect);

            setTimeout(() => {
                footer.textContent = defaultText;
            }, 9000);

        }, 500);

    }, 200);
}

function randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
