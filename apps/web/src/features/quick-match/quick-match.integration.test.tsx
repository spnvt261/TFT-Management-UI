import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { quickMatchSchema, type QuickMatchFormValues } from "@/features/quick-match/schema";

const TestQuickMatchValidationForm = ({ onValid }: { onValid: () => void }) => {
  const { register, handleSubmit } = useForm<QuickMatchFormValues>({
    resolver: zodResolver(quickMatchSchema),
    defaultValues: {
      module: "MATCH_STAKES",
      participantCount: 3,
      ruleSetId: "rule-1",
      ruleSetVersionId: "",
      note: "",
      participants: [
        { playerId: "p1", tftPlacement: 1 },
        { playerId: "p1", tftPlacement: 1 },
        { playerId: "p3", tftPlacement: 3 }
      ]
    }
  });

  return (
    <form onSubmit={handleSubmit(onValid)}>
      <input {...register("ruleSetId")} aria-label="rule-set" />
      <input {...register("participants.0.playerId")} aria-label="p0" />
      <input {...register("participants.1.playerId")} aria-label="p1" />
      <input {...register("participants.2.playerId")} aria-label="p2" />
      <button type="submit">submit</button>
    </form>
  );
};

describe("quick match component validation", () => {
  it("blocks submit on duplicate players or placements", async () => {
    const onValid = vi.fn();
    render(<TestQuickMatchValidationForm onValid={onValid} />);

    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(onValid).not.toHaveBeenCalled();
  });
});
