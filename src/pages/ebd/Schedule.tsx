import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Plus } from "lucide-react";

export default function EBDSchedule() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Criar Escala</h1>
            <p className="text-muted-foreground">Gerencie a escala de professores</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nova Escala
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Escalas Cadastradas
            </CardTitle>
            <CardDescription>Programação de professores por turma e data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma escala cadastrada</p>
              <p className="text-sm">Comece criando escalas para os professores</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}