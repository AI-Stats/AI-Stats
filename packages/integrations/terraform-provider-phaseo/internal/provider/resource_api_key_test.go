package provider

import (
	"reflect"
	"testing"
)

func TestNormalizeScopes(t *testing.T) {
	tests := []struct {
		name  string
		input any
		want  []string
	}{
		{name: "array", input: []any{"chat.completions", "responses"}, want: []string{"chat.completions", "responses"}},
		{name: "encoded array", input: `["chat.completions"]`, want: []string{"chat.completions"}},
		{name: "single value", input: "responses", want: []string{"responses"}},
		{name: "missing", input: nil, want: []string{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeScopes(tt.input); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("normalizeScopes() = %#v, want %#v", got, tt.want)
			}
		})
	}
}
