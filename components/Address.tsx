import { OPERATOR_ADDRESS, OPERATOR_NAME } from "@/lib/site";

export function OperatorBlock() {
  return (
    <p>
      <b>{OPERATOR_NAME}</b>
      {OPERATOR_ADDRESS.map((line) => (
        <span key={line}>
          <br />
          {line}
        </span>
      ))}
    </p>
  );
}
