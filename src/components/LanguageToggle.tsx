import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      title={lang === "ar" ? "Switch to English" : "التبديل للعربية"}
    >
      <Globe className="h-4 w-4" />
      <span className="sr-only">{lang === "ar" ? "EN" : "عربي"}</span>
    </Button>
  );
}
