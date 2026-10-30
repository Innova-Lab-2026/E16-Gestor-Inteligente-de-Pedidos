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
    <section aria-label="Pantalla de bienvenida">
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

      <p className={`${styles.tagline} ${transitioning ? styles.taglineToHeader : ""}`}>
        Pedidos, stock y cobros
        <br />
        en un solo lugar
      </p>
    </section>
  );
}
