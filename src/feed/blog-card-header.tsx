import { useNavigate } from "@tanstack/react-router";
import { proxyImage } from "@/lib/proxy";
import { useUiStore } from "../stores/useUiStore";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import type { BlogPost } from "../types/remote";

interface BlogCardHeaderProps {
  blog: BlogPost;
}

export function BlogCardHeader({ blog }: BlogCardHeaderProps) {
  const navigate = useNavigate();

  const handleProfileClick = () => {
    if (blog.user?.idstr) {
      useUiStore.getState().openHistoryProfile(blog.user.idstr);
      navigate({ to: "/" });
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarImage src={proxyImage(blog.user?.profile_image_url ?? "")} />
        <AvatarFallback>
          {blog.user?.screen_name?.charAt(0) ?? "U"}
        </AvatarFallback>
      </Avatar>

      <div>
        <button
          className="text-sm font-semibold text-foreground hover:underline"
          onClick={handleProfileClick}
        >
          {blog.user?.screen_name || "Unknown User"}
        </button>
        <p className="text-xs text-muted-foreground">
          {blog.created_at} {blog.region_name ? `• ${blog.region_name}` : ""}
        </p>
      </div>
    </div>
  );
}
