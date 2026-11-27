import Image from "next/image";
import styles from "./LoginScreen.module.css";

type SplashScreenProps = {
  transitioning: boolean;
  onEntranceEnd: () => void;
  onTransitionEnd: () => void;
};

export default function SplashScreen({
  transitioning,
  onEntranceEnd,
  onTransitionEnd,
}: SplashScreenProps) {
  const decorationTransitionClass = transitioning
    ? styles.decorationToTop
    : "";

  return (
    <section className={styles.brandPanel} aria-label="Pantalla de bienvenida">
      <Image
        src="/images/emprendete-logo.png"
        alt="Emprendete"
        width={324}
        height={272}
        priority
        className={`${styles.logo} ${transitioning ? styles.logoToHeader : ""}`}
        onAnimationEnd={(event) => {
          if (
            transitioning &&
            event.animationName.includes("logo-to-header")
          ) {
            onTransitionEnd();
          } else if (
            !transitioning &&
            event.animationName.includes("logo-enter")
          ) {
            onEntranceEnd();
          }
        }}
      />

      <span
        aria-hidden="true"
        className={`${styles.decoration} ${styles.asterisk} ${decorationTransitionClass}`}
      >
        *
      </span>
      <span
        aria-hidden="true"
        className={`${styles.decoration} ${styles.plus} ${decorationTransitionClass}`}
      >
        +
      </span>
      <span
        aria-hidden="true"
        className={`${styles.decoration} ${styles.hashtag} ${decorationTransitionClass}`}
      >
        #
      </span>

      <div className={styles.desktopDecorations} aria-hidden="true">
        <svg className={`${styles.decorIcon} ${styles.boxIcon}`} viewBox="0 0 64 64">
          <path d="m8 18 24-11 24 11-24 11L8 18Z" />
          <path d="M8 18v28l24 11 24-11V18M32 29v28M20 12.5l24 11.5" />
        </svg>
        <svg className={`${styles.decorIcon} ${styles.bagIcon}`} viewBox="0 0 72 72">
          <path d="M17 25h38l-3 37H20l-3-37Z" />
          <path d="M26 27v-8a10 10 0 0 1 20 0v8" />
        </svg>
        <svg className={`${styles.decorIcon} ${styles.chartIcon}`} viewBox="0 0 72 72">
          <path d="M12 10v50h50" />
          <path d="M23 47V35h10v12M39 47V24h10v23M55 47V15h7v32" />
          <path d="m23 29 13-9 10 5 14-13" />
        </svg>
      </div>

      <p className={`${styles.tagline} ${transitioning ? styles.taglineToHeader : ""}`}>
        Pedidos, stock y cobros
        <br />
        en un solo lugar
      </p>
    </section>
  );
}
