## Teste Técnico Shopper - Desenvolvedor Fullstack

### Dependências

O projeto está inteiramente dockerizado. As dependências são `docker` e `docker-compose`.

### Executando o Projeto

Para subir o monorepo, execute:

```sh
docker-compose up
```

O frontend abrirá na porta 5173, enquanto o backend abrirá na porta 3000.

Para usar a aplicação, acesse http://localhost:5173

### Testes de Integração

Testes de integração do back-end estão disponíveis e podem ser executados com:

```sh
npm test
```

Ou pode ser executado dentro do container com:

```
docker-compose exec backend npm test
```
