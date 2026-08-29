import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryFilter } from "./CategoryFilter";

describe("CategoryFilter", () => {
  it("renders an 'All' chip plus one per category", () => {
    render(<CategoryFilter selected={null} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Graphic / Signage" }),
    ).toBeInTheDocument();
  });

  it("calls onChange with the category, and null when 'All' is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CategoryFilter selected="shop" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Architecture" }));
    expect(onChange).toHaveBeenCalledWith("architecture");

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
