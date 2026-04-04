import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Globe, Smartphone, Monitor } from "lucide-react";

export default function RevistaMapa() {
  const [filtroRevista, setFiltroRevista] = useState<string>("todas");

  const { data: acessos = [], isLoading } = useQuery({
    queryKey: ["revista-acessos-geo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revista_acessos_geo" as any)
        .select("id, whatsapp, cidade, estado, latitude, longitude, latitude_gps, longitude_gps, fonte_localizacao, is_mobile, created_at, revista_id")
        .not("latitude", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: revistas = [] } = useQuery({
    queryKey: ["revistas-digitais-filter"],
    queryFn: async () => {
      const { data } = await supabase
        .from("revistas_digitais")
        .select("id, titulo")
        .order("titulo");
      return (data || []) as { id: string; titulo: string }[];
    },
  });

  const filtered = useMemo(() => {
    if (filtroRevista === "todas") return acessos;
    return acessos.filter((a: any) => a.revista_id === filtroRevista);
  }, [acessos, filtroRevista]);

  const stats = useMemo(() => {
    const cidades = new Set(filtered.map((a: any) => a.cidade).filter(Boolean));
    const estados = new Set(filtered.map((a: any) => a.estado).filter(Boolean));
    const mobile = filtered.filter((a: any) => a.is_mobile).length;
    return {
      total: filtered.length,
      cidades: cidades.size,
      estados: estados.size,
      mobile,
      desktop: filtered.length - mobile,
      pctMobile: filtered.length > 0 ? Math.round((mobile / filtered.length) * 100) : 0,
    };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mapa de Leitores</h1>
          <p className="text-sm text-muted-foreground">Visualize de onde seus leitores acessam as revistas digitais</p>
        </div>
        <Select value={filtroRevista} onValueChange={setFiltroRevista}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Filtrar por revista" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as revistas</SelectItem>
            {revistas.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.titulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <MapPin className="h-5 w-5 mx-auto mb-1 text-[#f6ba32]" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total de acessos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Globe className="h-5 w-5 mx-auto mb-1 text-[#f6ba32]" />
            <p className="text-2xl font-bold">{stats.cidades}</p>
            <p className="text-xs text-muted-foreground">Cidades únicas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Globe className="h-5 w-5 mx-auto mb-1 text-[#f6ba32]" />
            <p className="text-2xl font-bold">{stats.estados}</p>
            <p className="text-xs text-muted-foreground">Estados únicos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Smartphone className="h-5 w-5 mx-auto mb-1 text-[#f6ba32]" />
            <p className="text-2xl font-bold">{stats.pctMobile}%</p>
            <p className="text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Smartphone className="h-3 w-3" /> {stats.mobile}</span>
              {" / "}
              <span className="inline-flex items-center gap-1"><Monitor className="h-3 w-3" /> {stats.desktop}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-hidden rounded-lg" style={{ height: "500px" }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">Carregando mapa...</div>
          ) : (
            <MapContainer
              center={[-14.235, -51.925]}
              zoom={4}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filtered.map((a: any) => {
                const lat = a.latitude_gps ?? a.latitude;
                const lng = a.longitude_gps ?? a.longitude;
                const isGps = a.fonte_localizacao === "gps";
                if (!lat || !lng) return null;
                return (
                  <CircleMarker
                    key={a.id}
                    center={[Number(lat), Number(lng)]}
                    radius={7}
                    pathOptions={{
                      fillColor: isGps ? "#1d9e4e" : "#f6ba32",
                      color: isGps ? "#1d9e4e" : "#f6ba32",
                      weight: 1,
                      fillOpacity: 0.8,
                    }}
                  >
                    <Popup>
                      <div className="text-sm space-y-1">
                        <p className="font-semibold">{a.cidade || "—"}, {a.estado || "—"}</p>
                        <p>{a.is_mobile ? "📱 Mobile" : "💻 Desktop"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString("pt-BR")} às{" "}
                          {new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="text-xs">
                          {isGps ? "📍 GPS" : "🌐 IP"} — {a.whatsapp || "sem whatsapp"}
                        </p>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#f6ba32" }} /> Localização por IP
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#1d9e4e" }} /> Localização por GPS (mais precisa)
        </span>
      </div>
    </div>
  );
}
