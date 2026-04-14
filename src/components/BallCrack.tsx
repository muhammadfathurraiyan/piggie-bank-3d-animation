import ball from "../assets/images/img-ball.png";

export function CoinEnter() {
  return (
    <div className="space-y-8">
      <p className="font-light text-[#FFF2D3] text-lg">-10 USDC</p>
      <div className="relative flex items-center justify-center size-fit mx-auto">
        <div className="absolute size-[120%] aspect-square left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFF2D3] blur-[12.5px]" />
        <img src={ball} alt="Ball" className="size-[200px] object-cover" />
      </div>
    </div>
  );
}
