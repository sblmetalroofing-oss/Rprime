import "./RPrimeLoader.css";
import logo from "./RPrime_logo.png";

export default function RPrimeLoader() {
  return (
    <div className="rprime-loader">
      <img src={logo} alt="RPrime loading" className="logo" />
      <div className="dots">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
