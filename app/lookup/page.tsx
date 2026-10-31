"use client";

import { useState } from "react";
import { Hero } from "@/components/shared/Hero";
import { Results } from "@/components/shared/Results";
import type { SearchState } from "@/components/shared/Hero";

export default function LookupPage() {
  const [searchState, setSearchState] = useState<SearchState | null>(null);

  function handleClear() {
    setSearchState(null);
  }

  return (
    <main>
      <Hero
        onSearch={setSearchState}
        searchState={searchState}
        onClear={handleClear}
      />
      <Results searchState={searchState} />
    </main>
  );
}
