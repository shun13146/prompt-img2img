import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { BuilderPage } from "./pages/BuilderPage";
import { CharactersPage } from "./pages/CharactersPage";
import { QueuePage } from "./pages/QueuePage";
import { SettingsPage } from "./pages/SettingsPage";
import { useCharacterStore } from "./stores/characterStore";
import { useTagStore } from "./stores/tagStore";
import { useSettingsStore } from "./stores/settingsStore";

export default function App() {
  const fetchCharacters = useCharacterStore((s) => s.fetch);
  const fetchTags = useTagStore((s) => s.fetch);
  const fetchSettings = useSettingsStore((s) => s.fetch);

  useEffect(() => {
    fetchCharacters();
    fetchTags();
    fetchSettings();
  }, [fetchCharacters, fetchTags, fetchSettings]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<BuilderPage />} />
          <Route path="/characters" element={<CharactersPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
