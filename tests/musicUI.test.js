/**
 * @file musicUI.test.js
 * @description MusicUIModule の単体テスト
 *
 * 【テスト方針（SW105 シナリオD・2.4#3 検証条件対応）】
 * - play() は音声APIを呼ばずCSSクラスのみ操作することを検証
 * - 曲名が空またはnullの場合は吹き出しを非表示にすることを検証（境界値）
 * - stop() がCSSクラスを除去し再生中フラグをfalseにすることを検証
 */

import { MusicUIModule } from "../src/musicUI.js";

// DOM要素のモック
function mockElement(id) {
  return {
    id,
    classList: {
      _classes: new Set(),
      add(cls) { this._classes.add(cls); },
      remove(cls) { this._classes.delete(cls); },
      contains(cls) { return this._classes.has(cls); },
    },
    style: {},
    textContent: "",
  };
}

describe("MusicUIModule", () => {
  let carIcon, musicBubble, module;

  beforeEach(() => {
    carIcon = mockElement("car-icon");
    musicBubble = mockElement("music-bubble");
    module = new MusicUIModule({ carIcon, musicBubble });
  });

  // ============================================================
  // テスト: play() - 正常系・曲名あり
  // ============================================================
  test("[正常系] play('勝手にシンドバッド') で playing クラスが付与される", () => {
    module.play("勝手にシンドバッド");
    expect(carIcon.classList.contains("playing")).toBe(true);
  });

  test("[正常系] play('勝手にシンドバッド') で吹き出しに曲名が表示される", () => {
    module.play("勝手にシンドバッド");
    expect(musicBubble.textContent).toContain("勝手にシンドバッド");
    expect(musicBubble.style.display).toBe("block");
  });

  test("[正常系] play() 後に isPlaying が true になる", () => {
    module.play("勝手にシンドバッド");
    expect(module.isPlaying).toBe(true);
  });

  // ============================================================
  // テスト: play() - 空文字・null 境界値
  // ============================================================
  test("[境界値] play('') で playing クラスは付与されるが吹き出しは非表示", () => {
    module.play("");
    expect(carIcon.classList.contains("playing")).toBe(true);
    expect(musicBubble.style.display).toBe("none");
  });

  test("[境界値] play(null) で playing クラスは付与されるが吹き出しは非表示", () => {
    module.play(null);
    expect(carIcon.classList.contains("playing")).toBe(true);
    expect(musicBubble.style.display).toBe("none");
  });

  // ============================================================
  // テスト: stop()
  // ============================================================
  test("[正常系] stop() で playing クラスが除去される", () => {
    module.play("勝手にシンドバッド");
    module.stop();
    expect(carIcon.classList.contains("playing")).toBe(false);
  });

  test("[正常系] stop() で isPlaying が false になる", () => {
    module.play("勝手にシンドバッド");
    module.stop();
    expect(module.isPlaying).toBe(false);
  });

  test("[正常系] stop() で吹き出しが非表示になる", () => {
    module.play("勝手にシンドバッド");
    module.stop();
    expect(musicBubble.style.display).toBe("none");
  });

  // ============================================================
  // テスト: DOM要素なし（クラッシュしない）
  // ============================================================
  test("[異常系] DOM要素なしでも play/stop がクラッシュしない", () => {
    const noEl = new MusicUIModule({});
    expect(() => noEl.play("テスト")).not.toThrow();
    expect(() => noEl.stop()).not.toThrow();
  });
});
