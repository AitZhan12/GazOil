import { Link } from 'react-router';
import { AlertCircle } from 'lucide-react';
import { Button } from './ui/button';

export function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <AlertCircle className="size-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Страница не найдена
        </h2>
        <p className="text-gray-500 mb-6">
          Запрашиваемая страница не существует
        </p>
        <Link to="/">
          <Button>Вернуться на главную</Button>
        </Link>
      </div>
    </div>
  );
}
