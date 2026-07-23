$(function () {
  initVideoTagControl();

  const clinicIframeController = new ClinicIframeController('js-clinic-list-iframe');
  clinicIframeController.init();
});

/**
 * 動画再生制御
 */
const initVideoTagControl = () => {
  try {
    const IGNORE_CLASS_NAME = 'js-ignore-video-play';
    const $videoItem = $('video');

    if ($videoItem.length === 0) return;

    $('body').on('touchstart.video_autoplay_trigger click.video_autoplay_trigger', () => {
      const noPauseViewport = $(window).height() * 3;
      const currentViewportTop = $(window).scrollTop();
      const currentViewportBottom = currentViewportTop + $(window).height();

      $videoItem.each(async function () {
        if (!$(this).hasClass(IGNORE_CLASS_NAME)) {
          this.muted = true;
          await this.play();
        }

        const videoTop = $(this).offset().top;
        const videoBottom = videoTop + $(this).outerHeight();

        if ($(this).offset().top > noPauseViewport && (videoBottom < currentViewportTop || videoTop > currentViewportBottom) && !$(this).hasClass(IGNORE_CLASS_NAME)) {
          this.pause();
          this.currentTime = 0;
        }
      });

      $('body').off('touchstart.video_autoplay_trigger click.video_autoplay_trigger');
    });

    const handleIntersection = (entries) => {
      entries.forEach((entry) => {
        const videoElement = entry.target;

        if (entry.isIntersecting) {
          if (videoElement.paused && !videoElement.classList.contains(IGNORE_CLASS_NAME)) {
            videoElement.play();
          }
        } else {
          if (!videoElement.paused && videoElement.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && !videoElement.classList.contains(IGNORE_CLASS_NAME)) {
            videoElement.pause();
          }
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, {
      root: null,
      threshold: [0],
    });

    $videoItem.each(function () {
      observer.observe(this);
    });
  } catch (error) {
    console.error(error.message);
  }
};

/**
 * クリニック一覧のiframe制御
 */
class ClinicIframeController {
  constructor(iframeId) {
    this.srcPageOrigin = ['https://xb596558.xbiz.jp', 'https://xb740800.xbiz.jp', 'https://xb489399.xbiz.jp'];
    this.iframeId = iframeId;
    this.$iframeParent = $(`#${this.iframeId}`);
    this.$iframe = $(`#${this.iframeId} > iframe`);

    /**
     * NOTE: iframeを差し替える場合、以下のような値に変更する
     * ex. this.isReplaceIframe = true;
     *     this.replaceOrigin = 'https://xb489399.xbiz.jp';
     */
    this.isReplaceIframe = false;
    this.replaceOrigin = '';
  }

  init() {
    try {
      if (this.$iframeParent.length === 0 || this.$iframe.length === 0) return;

      // スクロール制御、アニメーションの有効化
      this.$iframe.attr('scrolling', 'no');
      this.$iframe.css('transition', 'height .2s');

      if (this.isReplaceIframe && this.replaceOrigin) {
        this.replaceIframeTag();
      }

      this.$iframe.on('load', () => {
        this.getHeight();
      });

      window.addEventListener('message', (e) => {
        // 有効なオリジン以外からの受信ははじく
        if (!this.srcPageOrigin.includes(e.origin)) return;

        const { data, source } = e;
        // e には送信もとのページ情報が格納され、e.source は、同じURLでも 別々の contentWindow となる
        // 上記値と埋め込み元のiframeのcontentWindow が等しいかで送信元のiframeだけheightを更新する
        if (data && data?.action === 'sendIframeHeight' && data?.iframeHeight && source === this.$iframe[0].contentWindow) {
          this.$iframe.height(data?.iframeHeight);
        }
      });
    } catch (error) {
      console.error(error.message);
    }
  }

  getHeight() {
    const iframeWindow = this.$iframe[0].contentWindow;
    iframeWindow.postMessage({ action: 'getHeight' }, '*');
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  replaceIframeTag() {
    const iframeSrc = this.$iframe.attr('src');

    if (this.$iframeParent.length === 0 || !this.isValidUrl(iframeSrc)) return;

    const urlObject = new URL(iframeSrc);
    const newSrc = urlObject.href.replace(urlObject.origin, this.replaceOrigin);
    const newIframe = $('<iframe>', {
      id: this.iframeId,
      scrolling: 'no',
      allowfullscreen: true,
      class: this.$iframe.attr('class') || '',
      css: {
        width: '100%',
        height: this.$iframe.css('height') || 1000,
        border: 'none',
        transition: 'height .2s',
      },
      src: newSrc,
    });

    this.$iframe.remove();
    this.$iframeParent.append(newIframe);

    // 新しいiframeを再設定
    this.$iframe = $(`#${this.iframeId} > iframe`);
  }
}
