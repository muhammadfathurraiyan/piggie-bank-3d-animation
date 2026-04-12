import { type SVGProps } from "react";
import { motion } from "motion/react";

type ResultsOverlayProps = {
  onContinue: () => void;
};

const FLASH = {
  DURATION: 2.35,
  TIMES: [0, 0.01, 0.42, 1] as const,
} as const;

const BACKDROP = { DELAY_S: 1.15, DURATION_S: 0.75 } as const;
const CONTENT = { DELAY_S: 1.35, DURATION_S: 0.85 } as const;
const CONTINUE_BTN = { DELAY_S: 1.85, DURATION_S: 0.5 } as const;

const FLASH_SURFACE_STYLE = {
  boxShadow:
    "inset 0 0 80px rgba(255,255,255,1), 0 0 120px rgba(255,255,255,0.85), 0 0 240px rgba(255,255,255,0.45)",
} as const;

const FLASH_GRADIENT_STYLE = {
  background:
    "radial-gradient(ellipse 85% 65% at 50% 42%, #ffffff 0%, #fffef8 35%, #f4f4fa 72%, #dcdce8 100%)",
} as const;

export function ResultsOverlay({ onContinue }: ResultsOverlayProps) {
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="results-heading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 p-6 pointer-events-auto"
    >
      <motion.div
        className="absolute inset-0 z-0 bg-zinc-950/90 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          delay: BACKDROP.DELAY_S,
          duration: BACKDROP.DURATION_S,
          ease: [0.22, 1, 0.36, 1],
        }}
      />

      <motion.div
        className="relative z-10 flex flex-col items-center space-y-8 text-center max-w-sm"
        initial={{ opacity: 0, scale: 0.88, y: 28, filter: "blur(10px)" }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
        transition={{
          delay: CONTENT.DELAY_S,
          duration: CONTENT.DURATION_S,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <h2 id="results-heading" className="sr-only">
          Result
        </h2>
        <div className="space-y-8">
          <div className="relative flex items-center justify-center size-fit mx-auto">
            <div className="absolute size-[120%] aspect-square left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFF2D3] blur-[12.5px]" />
            <ResultsIcon />
            <SparkleIcon className="absolute top-0 left-0" />
            <SparkleIcon className="absolute bottom-0 right-0 z-20" />
          </div>

          <p className="font-light text-[#FFF2D3] text-lg">-10 USDC</p>
        </div>

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: CONTINUE_BTN.DELAY_S,
            duration: CONTINUE_BTN.DURATION_S,
            ease: "easeOut",
          }}
          className="mt-2 px-5 py-2.5 text-sm font-medium uppercase tracking-wide text-zinc-900 bg-[#FFF2D3] rounded-md shadow-lg hover:bg-[#ffe8b8] transition-colors"
          onClick={() => onContinue()}
        >
          Continue
        </motion.button>
      </motion.div>

      <motion.div
        className="absolute inset-0 z-20 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{
          duration: FLASH.DURATION,
          times: [...FLASH.TIMES],
          ease: ["easeOut", "linear", "easeOut"],
        }}
      >
        <div className="absolute inset-0 bg-white" style={FLASH_SURFACE_STYLE} />
        <div
          className="absolute inset-0 opacity-95 mix-blend-screen"
          style={FLASH_GRADIENT_STYLE}
        />
      </motion.div>
    </motion.div>
  );
}

function ResultsIcon() {
  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="relative z-10"
    >
      <g clipPath="url(#clip0_3777_85133)">
        <rect x="2" y="2" width="48" height="48" rx="24" fill="#471903" />
        <path
          d="M26 2C29.1517 2 32.2728 2.62104 35.1846 3.82715C38.0963 5.03326 40.7422 6.80075 42.9707 9.0293C45.1992 11.2578 46.9667 13.9037 48.1729 16.8154C49.379 19.7272 50 22.8483 50 26C50 29.1517 49.379 32.2728 48.1729 35.1846C46.9667 38.0963 45.1992 40.7422 42.9707 42.9707C40.7422 45.1992 38.0963 46.9667 35.1846 48.1729C32.2728 49.379 29.1517 50 26 50C19.6348 50 13.5302 47.4716 9.0293 42.9707C4.52842 38.4698 2 32.3652 2 26C2 19.6348 4.52842 13.5302 9.0293 9.0293C13.5302 4.52842 19.6348 2 26 2ZM30.3203 11.626C33.4076 12.5612 36.1121 14.4647 38.0352 17.0547C39.9582 19.6447 40.9978 22.7848 41 26.0107C40.9977 29.2365 39.9581 32.3759 38.0352 34.9658C36.1121 37.5558 33.4076 39.4593 30.3203 40.3945V43.4873C34.2276 42.526 37.6995 40.2818 40.1797 37.1133C42.6599 33.9445 44.0054 30.0347 44 26.0107C44.0048 21.9871 42.659 18.0775 40.1787 14.9092C37.6985 11.7412 34.2272 9.49728 30.3203 8.53613V11.626ZM21.6797 8.53613C17.7728 9.49728 14.3015 11.7412 11.8213 14.9092C9.34101 18.0775 7.99516 21.9871 8 26.0107C7.99524 30.0343 9.34108 33.9431 11.8213 37.1113C14.3015 40.2794 17.7727 42.5242 21.6797 43.4854V40.3945C18.5902 39.4631 15.8826 37.5605 13.959 34.9697C12.0355 32.379 10.998 29.2374 11 26.0107C11.0022 22.7848 12.0418 19.6447 13.9648 17.0547C15.8879 14.4647 18.5924 12.5612 21.6797 11.626V8.53613ZM24.501 17.8359C21.6343 18.2013 19.834 19.8679 19.834 22.3506C19.8344 28.5154 29.4638 26.2036 29.4639 29.5342C29.4639 30.7928 28.2502 31.6328 26.1943 31.6328C23.5092 31.6328 22.624 30.449 22.2959 28.8145H19.3057C19.5004 31.8063 21.3435 33.6752 24.498 34.1445V36.5078H27.498V34.1738C30.5727 33.7765 32.4502 31.9875 32.4502 29.3555C32.4501 23.2198 22.8347 25.7393 22.834 22.3506C22.834 21.1346 23.8103 20.3555 25.6689 20.3555C27.8901 20.3555 28.6555 21.4355 28.8955 22.8887H31.9541C31.6821 20.1582 30.1141 18.4356 27.501 17.9209V15.5098H24.501V17.8359Z"
          fill="#FF7300"
        />
      </g>
      <rect
        x="1"
        y="1"
        width="50"
        height="50"
        rx="25"
        stroke="url(#paint0_linear_3777_85133)"
        strokeWidth="2"
      />
      <defs>
        <linearGradient
          id="paint0_linear_3777_85133"
          x1="2"
          y1="2"
          x2="29.4215"
          y2="7.20334"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#361302" />
          <stop offset="0.25" stopColor="#A1400C" />
          <stop offset="0.5" stopColor="#FFB67A" />
          <stop offset="1" stopColor="#A1400C" />
        </linearGradient>
        <clipPath id="clip0_3777_85133">
          <rect x="2" y="2" width="48" height="48" rx="24" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function SparkleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M0.00152755 6.95885V6.77572C0.0854611 6.5224 0.254854 6.3759 0.506654 6.27518C3.26425 5.17946 5.1932 3.24747 6.29349 0.49292C6.38506 0.264011 6.50409 0.0854596 6.74063 0H7.03363C7.25796 0.0885117 7.38157 0.25638 7.47008 0.480711C8.55511 3.21847 10.4673 5.14284 13.1943 6.25076C13.4782 6.36521 13.6964 6.50561 13.7727 6.81388V6.88713C13.7147 7.22134 13.4858 7.36478 13.1867 7.48534C10.4749 8.58869 8.57037 10.5039 7.48076 13.2218C7.38767 13.4553 7.26559 13.6369 7.0321 13.7361H6.7391C6.51172 13.6415 6.38506 13.4721 6.29349 13.2417C5.20236 10.507 3.28867 8.58259 0.560068 7.47772C0.296058 7.37089 0.0885117 7.23965 0 6.96038L0.00152755 6.95885Z"
        fill="#FFF2D3"
      />
    </svg>
  );
}
