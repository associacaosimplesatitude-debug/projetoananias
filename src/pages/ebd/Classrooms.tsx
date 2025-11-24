import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, School } from "lucide-react";

export default function EBDClassrooms() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Cadastro de Salas</h1>
            <p className="text-muted-foreground">Gerencie as turmas da EBD</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nova Sala
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="w-5 h-5" />
              Salas Cadastradas
            </CardTitle>
            <CardDescription>Turmas e salas disponíveis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar sala..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="text-center py-12 text-muted-foreground">
              <School className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma sala cadastrada</p>
              <p className="text-sm">Comece adicionando turmas</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}