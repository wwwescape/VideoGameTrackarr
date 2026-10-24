import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { editFromDetail, useCanonicalAddress, useDetailBack, useEditReturn } from "../navState";

const Where = () => {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.hash}</div>;
};

const Detail = () => {
  const { back, toList } = useDetailBack("/games");
  return (
    <>
      <Where />
      <button onClick={back}>{toList ? "To list" : "Back"}</button>
    </>
  );
};

const Edit = () => {
  const returnToDetail = useEditReturn();
  return <button onClick={() => returnToDetail("/game/celeste")}>Save</button>;
};

function renderRoutes(initialEntries: (string | { pathname: string; state?: unknown })[], initialIndex?: number) {
  const router = createMemoryRouter(
    [
      { path: "/games", element: <Where /> },
      { path: "/game/:id", element: <Detail /> },
      { path: "/game/:id/edit", element: <Edit /> },
    ],
    { initialEntries, initialIndex }
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("detail page Back", () => {
  it("goes to the list when the page was opened directly", async () => {
    const router = renderRoutes(["/game/celeste"]);

    await userEvent.click(screen.getByRole("button", { name: "To list" }));
    expect(router.state.location.pathname).toBe("/games");
  });

  it("steps back once to wherever it was opened from inside the app", async () => {
    const router = renderRoutes(["/games"]);
    await router.navigate("/game/celeste");

    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/games");
    expect(router.state.historyAction).toBe("POP");
  });
});

describe("edit page return", () => {
  it("steps back to the detail page it was opened from instead of pushing another copy", async () => {
    const router = renderRoutes(["/games"]);
    await router.navigate("/game/celeste");
    await router.navigate("/game/celeste/edit", { state: editFromDetail });

    await userEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(router.state.location.pathname).toBe("/game/celeste");
    // Back from there goes to the list, not the edit page.
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/games");
  });

  it("replaces itself with the detail page when it was opened directly", async () => {
    const router = renderRoutes(["/game/celeste/edit"]);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(router.state.location.pathname).toBe("/game/celeste");
    expect(router.state.historyAction).toBe("REPLACE");
  });
});

describe("canonical address", () => {
  const Renamed = () => {
    useCanonicalAddress("/game/celeste-deluxe-uuid1");
    return <Where />;
  };

  it("corrects the address in place, keeping the hash", async () => {
    const router = createMemoryRouter([{ path: "/game/:id", element: <Renamed /> }], {
      initialEntries: ["/game/celeste-uuid1#library"],
    });
    render(<RouterProvider router={router} />);

    expect(await screen.findByText("/game/celeste-deluxe-uuid1#library")).toBeInTheDocument();
    expect(router.state.historyAction).toBe("REPLACE");
  });
});
