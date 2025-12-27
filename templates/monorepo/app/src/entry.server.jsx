import { FoxgirlCreampie, Router, Route } from 'cumstack';
import Home from './pages/Home.jsx';
import NotFound from './pages/404.jsx';

export default function () {
  return (
    <FoxgirlCreampie>
      <Router>
        <Route path="/" component={Home} />
        <Route path="/404" component={NotFound} />
      </Router>
    </FoxgirlCreampie>
  );
}
