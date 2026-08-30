export const days = [
  { key: "mon", label: "Segunda-feira" },
  { key: "tue", label: "Terça-feira" },
  { key: "wed", label: "Quarta-feira" },
  { key: "thu", label: "Quinta-feira" },
  { key: "fri", label: "Sexta-feira" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

export const times = Array.from({ length: 18 }, (_, index) => String(index + 6).padStart(2, "0") + ":00");

export const defaults = {
  "mon-06:00": ["Leitura 40m", "pessoal"], "mon-07:00": ["Tarefas & treino", "pessoal"], "mon-13:00": ["Trabalho", "work"], "mon-14:00": ["Trabalho", "work"], "mon-15:00": ["Trabalho", "work"], "mon-16:00": ["Trabalho", "work"], "mon-18:00": ["Curso livre", "pessoal"], "mon-22:00": ["Ritual 5S", "personal"],
  "tue-06:00": ["Leitura 40m", "pessoal"], "tue-07:00": ["Tarefas & treino", "pessoal"], "tue-13:00": ["Trabalho", "work"], "tue-14:00": ["Trabalho", "work"], "tue-15:00": ["Trabalho", "work"], "tue-16:00": ["Trabalho", "work"], "tue-18:00": ["Curso livre", "pessoal"], "tue-22:00": ["Ritual 5S", "personal"],
  "wed-06:00": ["Leitura 40m", "pessoal"], "wed-07:00": ["Tarefas", "pessoal"], "wed-13:00": ["Trabalho", "work"], "wed-14:00": ["Trabalho", "work"], "wed-15:00": ["Trabalho", "work"], "wed-16:00": ["Trabalho", "work"], "wed-22:00": ["Ritual 5S", "personal"],
  "thu-06:00": ["Leitura 40m", "pessoal"], "thu-07:00": ["Tarefas & treino", "pessoal"], "thu-13:00": ["Trabalho", "work"], "thu-14:00": ["Trabalho", "work"], "thu-15:00": ["Trabalho", "work"], "thu-16:00": ["Trabalho", "work"], "thu-18:00": ["Curso livre", "pessoal"], "thu-22:00": ["Ritual 5S", "personal"],
  "fri-06:00": ["Leitura 40m", "pessoal"], "fri-07:00": ["Tarefas & treino", "pessoal"], "fri-13:00": ["Trabalho", "work"], "fri-14:00": ["Trabalho", "work"], "fri-15:00": ["Trabalho", "work"], "fri-16:00": ["Trabalho", "work"], "fri-18:00": ["Curso livre", "pessoal"], "fri-22:00": ["Ritual 5S", "personal"],
  "sat-06:00": ["Faxina Kaizen", "personal"], "sat-08:00": ["Leitura 1h30", "pessoal"], "sat-12:00": ["Almoço fixo", "personal"], "sat-17:00": ["Lazer / Amigos", "personal"],
  "sun-06:00": ["Setup 5S", "personal"], "sun-09:00": ["Igreja", "personal"], "sun-12:00": ["Almoço em família", "personal"], "sun-17:00": ["Setup da semana", "pessoal"], "sun-23:00": ["Dormir", "personal"],
};
