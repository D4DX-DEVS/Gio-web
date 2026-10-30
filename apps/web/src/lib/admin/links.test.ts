// Admin input checks: links editors put on the site and YouTube links for the video list.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { LinkError, safeLink } from "./links.ts";
import { youtubeId } from "../youtube.ts";

describe("safeLink", () => {
  test("keeps site paths, web links, mailto and tel", () => {
    for (const v of ["/about-us/", "/wp-content/uploads/2024/01/a.pdf", "#top", "https://giokerala.org/x", "http://example.org", "mailto:office@example.org", "tel:+914842000000"]) {
      assert.equal(safeLink(` ${v} `), v);
    }
  });
  test("empty is null", () => {
    assert.equal(safeLink(""), null);
    assert.equal(safeLink("   "), null);
    assert.equal(safeLink(null), null);
  });
  test("refuses script and data links and protocol-relative hosts", () => {
    for (const v of ["javascript:alert(1)", "JavaScript:alert(1)", " javascript:alert(1)", "data:text/html,<script>", "//evil.example/x", "vbscript:x", "about-us", "https://", "https://no-dot"]) {
      assert.throws(() => safeLink(v), LinkError, v);
    }
  });
});

describe("youtubeId", () => {
  const ID = "GXMUeZOmWFs";
  test("accepts every common link form", () => {
    for (const v of [
      ID,
      `https://youtu.be/${ID}`,
      `https://youtu.be/${ID}?si=abc`,
      `https://www.youtube.com/watch?v=${ID}`,
      `https://m.youtube.com/watch?v=${ID}&t=30s`,
      `youtube.com/watch?v=${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}?rel=0`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/live/${ID}`,
    ]) {
      assert.equal(youtubeId(v), ID, v);
    }
  });
  test("refuses other sites and malformed ids", () => {
    for (const v of ["", "https://vimeo.com/12345678", `https://evil.example/watch?v=${ID}`, "https://www.youtube.com/@giokerala5691", "https://youtu.be/short", "javascript:alert(1)", "not a link"]) {
      assert.equal(youtubeId(v), null, v);
    }
  });
});
