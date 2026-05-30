/** BlogPanel - Composes the editor and the feed for the ブログ tab. */

import { BlogEditor } from './BlogEditor';
import { BlogFeed } from './BlogFeed';

export function BlogPanel(): JSX.Element {
  return (
    <div className="blog">
      <BlogEditor />
      <BlogFeed />
    </div>
  );
}
