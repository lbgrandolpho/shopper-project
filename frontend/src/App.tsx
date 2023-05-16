import { useState } from 'react';

const BACKEND_URL = "http://172.17.0.1:3000"

function App() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [validationErrs, setValidationErrs] = useState(null);
  const [products, setProducts] = useState(null);

  const handleUpdate = async () => {
    if (!csvFile) return;
    const csvContent = await csvFile.text();
    const res = await fetch(`${BACKEND_URL}/products/update`, {
      method: 'POST',
      mode: 'cors',
      body: csvContent,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  };

  const handleValidation = async () => {
    if (!csvFile) return;
    const csvContent = await csvFile.text();
    const res = await fetch(`${BACKEND_URL}/products/validate`, {
      method: 'POST',
      mode: 'cors',
      body: csvContent,
      headers: {
        'Content-Type': 'text/plain',
      },
    });

    if (res.status === 400) {
      setIsValid(false);
      const body = await res.json();
      setValidationErrs(body);
    }

    if (res.status === 200) {
      setIsValid(true);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setCsvFile(e.target.files[0]);
  };

  return (
    <div>
      <h1>Atualizar Preços</h1>
      <input
        type="file"
        className="file-input w-full max-w-xs"
        onChange={handleUpload}
      />
      <button
        disabled={!csvFile}
        className="btn btn-primary"
        onClick={handleValidation}
      >
        Validar
      </button>
      <button
        className="btn btn-secondary"
        onClick={handleUpdate}
        disabled={!isValid}
      >
        Atualizar
      </button>
      {!!validationErrs ? <div>{validationErrs.errors}</div> : ''}
    </div>
  );
}

export default App;
